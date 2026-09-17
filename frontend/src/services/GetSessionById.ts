const Api_url = process.env.NEXT_PUBLIC_API_URL;

export const GetSessionById = async (id: string) => {

    const token = localStorage.getItem("token");

    const response = await fetch(
        `${Api_url}/api/sessions/${id}`,
        {
            method:"GET",
            headers:{
                Authorization:`Bearer ${token}`,
                "Content-Type":"application/json",
            }
        }
    );


    if(!response.ok){

        if(response.status === 401){

            localStorage.removeItem("token");
            window.location.href="/login";
        }

        throw new Error("Something went wrong");
    }


    return response.json();
};