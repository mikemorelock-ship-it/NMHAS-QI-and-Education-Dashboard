// ---------------------------------------------------------------------------
// DOR Notification Email Template
// ---------------------------------------------------------------------------

const RATING_LABELS: Record<number, string> = {
  1: "Not Acceptable",
  2: "Not Acceptable",
  3: "Below Standard",
  4: "Acceptable",
  5: "Above Standard",
  6: "Superior",
  7: "Superior",
};

const RATING_COLORS: Record<number, string> = {
  1: "#b91c1c",
  2: "#ef4444",
  3: "#f97316",
  4: "#6b7280",
  5: "#22c55e",
  6: "#16a34a",
  7: "#047857",
};

const RECOMMEND_LABELS: Record<string, string> = {
  continue: "Continue in Current Phase",
  advance: "Advance to Next Phase",
  extend: "Extend Current Phase",
  remediate: "Place on Remedial Training",
  nrt: "Not Responding to Training",
  release: "Recommend Release to Solo",
  terminate: "Recommend Termination",
};

export interface DorEmailData {
  dorId: string;
  traineeName: string;
  ftoName: string;
  date: string;
  phaseName: string | null;
  overallRating: number;
  narrative: string | null;
  recommendAction: string;
  nrtFlag: boolean;
  remFlag: boolean;
  mostSatisfactory: string | null;
  leastSatisfactory: string | null;
  ratings: { categoryName: string; rating: number; comments: string | null }[];
  portalUrl: string;
}

export function buildDorNotificationEmail(data: DorEmailData): {
  subject: string;
  html: string;
} {
  const isPoor = data.overallRating <= 3;
  const hasFlags = data.nrtFlag || data.remFlag;
  const isUrgent = isPoor || hasFlags;

  // Build subject line
  let subject = `DOR Submitted: ${data.traineeName}`;
  if (data.nrtFlag) subject = `🚨 NRT FLAG — ${subject}`;
  else if (data.remFlag) subject = `⚠️ REM FLAG — ${subject}`;
  else if (isPoor) subject = `⚠️ Low Score — ${subject}`;

  const dorUrl = `${data.portalUrl}/fieldtraining/dors/${data.dorId}`;
  const dateFormatted = new Date(data.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Build ratings rows
  const ratingsHtml = data.ratings
    .map(
      (r) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">
          ${r.categoryName}
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <span style="display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 13px; font-weight: 600; color: white; background-color: ${RATING_COLORS[r.rating]};">
            ${r.rating}/7
          </span>
        </td>
        ${r.comments ? `<td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;">${escapeHtml(r.comments)}</td>` : `<td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #9ca3af; font-size: 13px;">—</td>`}
      </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

        <!-- Header -->
        <tr>
          <td style="background-color: #0d9488; padding: 20px 24px;">
            <h1 style="margin: 0; color: white; font-size: 18px; font-weight: 600;">
              NMH EMS — Daily Observation Report
            </h1>
          </td>
        </tr>

        ${
          isUrgent
            ? `
        <!-- Alert Banner -->
        <tr>
          <td style="background-color: ${data.nrtFlag ? "#fef2f2" : "#fff7ed"}; padding: 14px 24px; border-bottom: 2px solid ${data.nrtFlag ? "#fca5a5" : "#fdba74"};">
            <p style="margin: 0; font-size: 14px; font-weight: 600; color: ${data.nrtFlag ? "#991b1b" : "#9a3412"};">
              ${data.nrtFlag ? "🚨 NRT — Not Responding to Training" : ""}
              ${data.remFlag ? "⚠️ REM — Remedial Training Recommended" : ""}
              ${isPoor && !hasFlags ? `⚠️ Low Overall Score: ${data.overallRating % 1 !== 0 ? data.overallRating.toFixed(1) : data.overallRating}/7 — ${RATING_LABELS[Math.round(data.overallRating)]}` : ""}
            </p>
          </td>
        </tr>
        `
            : ""
        }

        <!-- DOR Summary -->
        <tr>
          <td style="padding: 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #6b7280; width: 140px;">Trainee:</td>
                <td style="padding: 6px 0; font-size: 14px; font-weight: 600;">${escapeHtml(data.traineeName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">FTO:</td>
                <td style="padding: 6px 0; font-size: 14px;">${escapeHtml(data.ftoName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Date:</td>
                <td style="padding: 6px 0; font-size: 14px;">${dateFormatted}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Phase:</td>
                <td style="padding: 6px 0; font-size: 14px;">${data.phaseName || "—"}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Overall Rating:</td>
                <td style="padding: 6px 0;">
                  <span style="display: inline-block; padding: 3px 12px; border-radius: 12px; font-size: 14px; font-weight: 700; color: white; background-color: ${RATING_COLORS[Math.round(data.overallRating)]};">
                    ${data.overallRating % 1 !== 0 ? data.overallRating.toFixed(1) : data.overallRating}/7 — ${RATING_LABELS[Math.round(data.overallRating)]}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Recommendation:</td>
                <td style="padding: 6px 0; font-size: 14px; font-weight: 500;">${RECOMMEND_LABELS[data.recommendAction] || data.recommendAction}</td>
              </tr>
            </table>

            ${
              data.mostSatisfactory || data.leastSatisfactory
                ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px;">
              ${
                data.mostSatisfactory
                  ? `<tr>
                <td style="padding: 6px 0; font-size: 14px; color: #6b7280; width: 180px;">Most Satisfactory:</td>
                <td style="padding: 6px 0; font-size: 14px; color: #16a34a; font-weight: 500;">${escapeHtml(data.mostSatisfactory)}</td>
              </tr>`
                  : ""
              }
              ${
                data.leastSatisfactory
                  ? `<tr>
                <td style="padding: 6px 0; font-size: 14px; color: #6b7280; width: 180px;">Least Satisfactory:</td>
                <td style="padding: 6px 0; font-size: 14px; color: #dc2626; font-weight: 500;">${escapeHtml(data.leastSatisfactory)}</td>
              </tr>`
                  : ""
              }
            </table>
            `
                : ""
            }
          </td>
        </tr>

        <!-- Category Ratings -->
        <tr>
          <td style="padding: 0 24px 16px;">
            <h3 style="margin: 0 0 8px; font-size: 15px; color: #374151;">Performance Ratings</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
              <tr style="background-color: #f9fafb;">
                <th style="padding: 8px 12px; text-align: left; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Category</th>
                <th style="padding: 8px 12px; text-align: center; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; width: 80px;">Rating</th>
                <th style="padding: 8px 12px; text-align: left; font-size: 13px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Comments</th>
              </tr>
              ${ratingsHtml}
            </table>
          </td>
        </tr>

        ${
          data.narrative
            ? `
        <!-- Narrative -->
        <tr>
          <td style="padding: 0 24px 24px;">
            <h3 style="margin: 0 0 8px; font-size: 15px; color: #374151;">Narrative / Notes</h3>
            <div style="padding: 12px 16px; background-color: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb; font-size: 14px; color: #374151; white-space: pre-wrap; line-height: 1.5;">
              ${escapeHtml(data.narrative)}
            </div>
          </td>
        </tr>
        `
            : ""
        }

        <!-- CTA Button -->
        <tr>
          <td style="padding: 0 24px 24px;" align="center">
            <a href="${dorUrl}" style="display: inline-block; padding: 12px 32px; background-color: #0d9488; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">
              View DOR in Portal
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color: #f9fafb; padding: 16px 24px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
              This is an automated notification from NMH EMS Dashboard. Do not reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
