const Api_url = process.env.NEXT_PUBLIC_API_URL;
export const DeleteSession = async (id: string) => {
  const response = await fetch(
    `${Api_url}/api/sessions/${id}`,
    {
      method: "DELETE",
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