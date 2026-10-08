"use client";

import { useApiQuery } from "@/lib/api/use-query";
import { Button, LinkButton } from "@/components/ui/button";
import { QueryState, panel, date } from "@/features/session/shared";
import { ExportButton } from "./export-button";
import { metric, type Analytics } from "./types";

export function AnalyticsScreen({ id }: { id: string }) {
  const query = useApiQuery<Analytics>(`/api/v1/exam-sessions/${id}/analytics`, true);
  const report = query.data;
  if (!report) return <QueryState error={query.error} retry={query.reload} />;
  const summary = report.overview;
  const maxCount = Math.max(1, ...report.distribution.map((b) => b.count));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <LinkButton variant="secondary" href={`/creator/sessions/${id}`}>
          Về kỳ thi
        </LinkButton>
        <LinkButton variant="secondary" href={`/creator/sessions/${id}/results`}>
          Xem kết quả
        </LinkButton>
        <Button variant="secondary" onClick={query.reload}>
          Làm mới
        </Button>
      </div>
      <header className="space-y-2">
        <h2 className="text-2xl font-bold [overflow-wrap:anywhere]">{report.title}</h2>
        <p>
          Tổng điểm: {report.totalScore} · Dữ liệu lúc {date(report.generatedAt)}
        </p>
        <ExportButton id={id} />
      </header>
      <section className={`${panel} space-y-4`} aria-labelledby="score-overview">
        <h3 id="score-overview" className="text-xl font-bold">
          Tổng quan điểm
        </h3>
        <p>
          Mẫu BEST_SCORE: {summary.gradedParticipantCount} người có điểm đã chấm, mỗi người lấy một
          lượt điểm cao nhất.
        </p>
        {summary.gradedParticipantCount === 0 && (
          <p role="status">Chưa có lượt đã chấm. Thống kê điểm sẽ xuất hiện khi có kết quả.</p>
        )}
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Điểm trung bình", metric(summary.averageScore)],
            ["Điểm cao nhất", metric(summary.highestScore)],
            ["Điểm thấp nhất", metric(summary.lowestScore)],
            ["Tỷ lệ đạt", metric(summary.passRate, "%")],
            [
              "Tỷ lệ hoàn thành",
              report.accessType === "PUBLIC"
                ? "Không áp dụng (PUBLIC)"
                : metric(summary.completionRate, "%"),
            ],
            [
              "Người đã hoàn thành",
              `${summary.completedParticipantCount} / ${summary.participantCount}`,
            ],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-background p-4">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">
          Hoàn thành gồm lượt đã nộp, hết giờ hoặc đã chấm. Với CLASS/INDIVIDUAL, mẫu số hợp nhất
          người hiện được giao với người từng có lượt làm, không đếm trùng.
        </p>
      </section>
      <section className={`${panel} space-y-4`} aria-labelledby="score-distribution">
        <h3 id="score-distribution" className="text-xl font-bold">
          Phân bố điểm
        </h3>
        <p>
          Điểm cao nhất theo phần trăm tổng điểm; mỗi người được đếm một lần. Cận trên không bao
          gồm, riêng nhóm cuối bao gồm 100%.
        </p>
        <ul className="space-y-3" aria-label="Số người theo khoảng điểm">
          {report.distribution.map((b) => (
            <li key={b.lowerPercent} className="grid grid-cols-[6rem_1fr_2rem] items-center gap-3">
              <span className="text-sm">
                {b.lowerPercent}–{b.upperPercent}%
              </span>
              <div className="h-5 rounded bg-muted" aria-hidden="true">
                <div
                  className="h-5 rounded bg-primary"
                  style={{ width: `${(100 * b.count) / maxCount}%` }}
                />
              </div>
              <span className="text-right font-bold">
                {b.count}
                <span className="sr-only"> người</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className={`${panel} space-y-4`} aria-labelledby="question-analytics">
        <h3 id="question-analytics" className="text-xl font-bold">
          Phân tích câu hỏi
        </h3>
        <p>
          Mẫu: toàn bộ lượt GRADED trong kỳ thi, gồm cả các lượt làm lại. Nội dung lấy từ snapshot
          đã xuất bản.
        </p>
        <p className="text-sm text-muted-foreground">
          Thời gian trung bình chỉ dùng telemetry hợp lệ; đây là dữ liệu do trình duyệt ghi nhận,
          không phải bằng chứng giám sát. Số mẫu thời gian có thể nhỏ hơn số lượt đã chấm.
        </p>
        <div
          className="overflow-x-auto rounded-lg border border-border focus-visible:outline-ring"
          tabIndex={0}
          role="region"
          aria-label="Bảng phân tích câu hỏi, cuộn ngang để xem đủ cột"
        >
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">
              Tỷ lệ đúng, sai, chưa trả lời và thời gian của từng snapshot
            </caption>
            <thead className="bg-muted">
              <tr>
                {[
                  "Câu hỏi / Snapshot",
                  "Số lượt",
                  "Đúng",
                  "Sai",
                  "Chưa trả lời",
                  "Thời gian trung bình",
                ].map((h) => (
                  <th scope="col" key={h} className="p-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.questions.map((q) => (
                <tr key={q.id} className="border-t border-border align-top">
                  <th scope="row" className="max-w-sm p-3 font-normal">
                    <details>
                      <summary className="cursor-pointer font-bold">
                        Câu {q.position + 1} · {q.points} điểm — Xem snapshot
                      </summary>
                      <div className="mt-3 space-y-2 whitespace-pre-wrap [overflow-wrap:anywhere]">
                        <p>{q.snapshot.content}</p>
                        {q.snapshot.options.map((o) => (
                          <p key={o.id}>
                            {o.content}
                            {o.correct && <strong> · Đáp án đúng</strong>}
                          </p>
                        ))}
                        {q.snapshot.correctBoolean != null && (
                          <p>Đáp án: {q.snapshot.correctBoolean ? "Đúng" : "Sai"}</p>
                        )}
                        {q.snapshot.correctValue != null && (
                          <p>
                            Đáp án: {q.snapshot.correctValue} · Sai số:{" "}
                            {q.snapshot.tolerance ?? "0"}
                          </p>
                        )}
                        {q.snapshot.explanation && <p>Giải thích: {q.snapshot.explanation}</p>}
                      </div>
                    </details>
                  </th>
                  <td className="p-3">{q.sampleCount}</td>
                  <td className="p-3">
                    {metric(q.correctRate, "%")} ({q.correctCount})
                  </td>
                  <td className="p-3">
                    {metric(q.incorrectRate, "%")} ({q.incorrectCount})
                  </td>
                  <td className="p-3">
                    {metric(q.unansweredRate, "%")} ({q.unansweredCount})
                  </td>
                  <td className="p-3">
                    {metric(
                      q.averageAnswerTimeMs == null ? null : q.averageAnswerTimeMs / 1000,
                      " giây",
                    )}
                    <span className="block text-muted-foreground">
                      {q.timedSampleCount} mẫu thời gian
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
