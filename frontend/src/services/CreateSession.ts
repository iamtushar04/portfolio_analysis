import Api from "@/services/Api";
export const CreateSession = async (name: string) => {
  const response = await Api.post(
    `/api/sessions/?name=${encodeURIComponent(name)}`,
  );

  return response.data;
};
