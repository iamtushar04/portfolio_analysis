import Api from "./Api";
export const DeleteSession = async (id: string) => {
  const response = await Api.delete(
    `/api/sessions/${id}`);

  return response.data;
};