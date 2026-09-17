import { error } from "console";

const Api_url = process.env.NEXT_PUBLIC_API_URL;
export const CreateSession = async (name: string) => {
  
    const response = await fetch(
    `${Api_url}/api/sessions/?name=${encodeURIComponent(name)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    }
  );

  if (!response.ok) {

    if (response.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        throw new Error("Session expired");
    }
    throw new Error("Failed to create session");
  }

  return response.json();
};