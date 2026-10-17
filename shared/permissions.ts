import type { User, Entity } from "./model.ts";
export function allowed(user: User, type: string, entity?: Entity) {
  if (type === "read-notification") return true;
  if (user.role === "director") return true;
  if (type === "import-students") return user.role === "admin";
  if (user.role === "admin")
    return (
      !["settings", "refund"].includes(type) &&
      !(type === "save" && entity === "tariffs")
    );
  if (user.role === "finance")
    return (
      [
        "issue",
        "payment",
        "refund",
        "subscription",
        "invoice",
        "deliver",
      ].includes(type) ||
      (type === "save" && entity === "tariffs")
    );
  return type === "attendance";
}
