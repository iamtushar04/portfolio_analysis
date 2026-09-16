import axios from "axios";

const Api_url = process.env.NEXT_PUBLIC_API_URL;
export const GetSessions = async () => {
    const response = axios.get(`${Api_url}/api/sessions/`, {
        headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
        }
    })
    return response; 
}
