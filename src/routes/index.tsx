import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gestão de Persianas — Início" },
      { name: "description", content: "Acesse o sistema interno de gestão da empresa de persianas." },
      { property: "og:title", content: "Gestão de Persianas" },
      { property: "og:description", content: "Sistema interno de gestão da empresa de persianas." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/estoque" });
  },
});
