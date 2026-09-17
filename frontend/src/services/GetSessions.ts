const Api_url = process.env.NEXT_PUBLIC_API_URL;
export const GetSessions = async () => {
    const response = await fetch(`${Api_url}/api/sessions/`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
        },
    })

    if (!response.ok) {
        throw new Error("Something went wrong");
    }

    return response.json(); 
}
