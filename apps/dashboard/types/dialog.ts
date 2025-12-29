export type DialogState =
  | { type: "closed" }
  | { type: "disable" }
  | { type: "delete" };

export const dialogActions = {
  close: (): DialogState => ({ type: "closed" }),
  disable: (): DialogState => ({ type: "disable" }),
  delete: (): DialogState => ({ type: "delete" }),
};
