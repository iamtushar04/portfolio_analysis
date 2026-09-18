const api_url = process.env.NEXT_PUBLIC_API_URL;

export const ExcelExport = async (id: string, translate: boolean) => {
    const token = localStorage.getItem("token");
    const response = await fetch(`${api_url}/api/sessions/${id}/export?translate=${translate}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        }
    })
    
    if(!response.ok){

        if(response.status === 401){

            localStorage.removeItem("token");
            window.location.href="/login";
        }

        throw new Error("Something went wrong");
    }

    return response.blob();
}