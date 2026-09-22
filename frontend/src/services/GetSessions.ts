import Api from "@/services/Api";
export const GetSessions = async () => {
    const response = await Api.get(`/api/sessions/`)

    return response.data; 
}
