import Api from "@/services/Api";

export const GetSessionById = async (id: string) => {
  const token = localStorage.getItem("token");

  const response = await Api.get(`/api/sessions/${id}`);

  return response.data;
};
