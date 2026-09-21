import Api from "./Api";

export const ExcelExport = async (id: string, translate: boolean) => {
    const response = await Api.get(`/api/sessions/${id}/export?translate=${translate}`, {
        responseType: "blob",
    })

    return response.data;
}