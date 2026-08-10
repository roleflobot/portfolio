import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LearningSession } from "@/lib/supabase/types";
import StudyView from "@/components/StudyView";

export default async function StudyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("learning_sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  return <StudyView session={data as LearningSession} />;
}
