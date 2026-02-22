export type DialogState =
  | { type: "closed" }
  | { type: "quarantine" }
  | { type: "delete" };

export const dialogActions = {
  close: (): DialogState => ({ type: "closed" }),
  quarantine: (): DialogState => ({ type: "quarantine" }),
  delete: (): DialogState => ({ type: "delete" }),
};
