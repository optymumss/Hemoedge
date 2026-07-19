export function orgInviteEmail(orgName: string) {
  return {
    subject: `You've been added to ${orgName} on HemoEdge`,
    html: `<p>You've been added to <strong>${orgName}</strong> on HemoEdge. Sign in to get started.</p>`,
  };
}

export function accountInviteEmail(context: string, actionLink: string) {
  return {
    subject: "You've been invited to HemoEdge",
    html: `
      <p>You've been invited to join HemoEdge${context ? ` — ${context}` : ""}.</p>
      <p><a href="${actionLink}">Accept your invite and set a password</a></p>
    `,
  };
}

export function reviewDecisionEmail(
  contentTitle: string,
  decision: "approved" | "changes_requested",
  notes: string | null,
) {
  const outcome = decision === "approved" ? "published" : "sent back for changes";
  return {
    subject: `${contentTitle}: ${outcome}`,
    html: `
      <p>Your submission <strong>${contentTitle}</strong> was ${outcome}.</p>
      ${notes ? `<p>Reviewer notes: ${notes}</p>` : ""}
    `,
  };
}

export function enquiryReceivedEmail(name: string, email: string, message: string) {
  return {
    subject: `New enquiry from ${name}`,
    html: `
      <p><strong>${name}</strong> (${email}) submitted an enquiry:</p>
      <p>${message}</p>
    `,
  };
}
