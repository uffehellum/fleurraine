import { useParams } from "react-router-dom";

export default function GardenRow() {
  const { row } = useParams<{ row: string }>();
  return <main className="p-4"><h1 className="font-heading text-2xl">Garden Row {row}</h1></main>;
}
