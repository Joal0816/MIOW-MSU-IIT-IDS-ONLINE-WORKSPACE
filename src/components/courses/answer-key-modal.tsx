import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { getQuizAnswerKey, type QuizAnswerKeyItem } from "@/lib/lms";
import { Modal } from "@/components/lms";

interface AnswerKeyModalProps {
  quizId: string | null;
  quizTitle: string;
  onClose: () => void;
}

function AnswerKeyRow({ item }: { item: QuizAnswerKeyItem }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-3">
      <span className="shrink-0 font-mono text-xs font-bold text-primary">[{item.bank_id}]</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-semibold">{item.position}.</span> {item.question}
        </p>
        <p className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {item.is_essay ? "Essay — see rubric" : `Answer: ${item.letter} — ${item.correct_answer}`}
        </p>
      </div>
    </div>
  );
}

export function AnswerKeyModal({ quizId, quizTitle, onClose }: AnswerKeyModalProps) {
  const { data: answerKey, isLoading } = useQuery({
    queryKey: ["answer-key", quizId],
    queryFn: () => getQuizAnswerKey(quizId!),
    enabled: !!quizId,
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal open={!!quizId} onClose={onClose} title={`Answer Key — ${quizTitle}`} wide>
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Total items: {answerKey?.length ?? 0}</p>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
          </div>

          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {answerKey?.map((item) => (
              <AnswerKeyRow key={item.bank_id} item={item} />
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
