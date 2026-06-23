import { useParams } from "react-router-dom";

export default function FlowerDetail() {
  const { name } = useParams<{ name: string }>();
  return <main className="p-4"><h1 className="font-heading text-2xl">{name}</h1></main>;
}
