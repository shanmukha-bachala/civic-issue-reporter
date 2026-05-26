const { query } = require('../../config/database');

/**
 * Simulate sending an email by updating the issue's email_status
 * and logging to console. Returns the updated email_status string.
 * Optionally persists a summary in issues.email_summary.
 *
 * @param {string} issueId
 * @param {string} departmentEmail
 * @param {string} [summary]
 * @returns {Promise<string>} email_status
 */
async function simulateSendEmail(issueId, departmentEmail, summary) {
  const status = `Sent to ${departmentEmail}`;
  if (summary) {
    await query('UPDATE issues SET email_status = $2, email_summary = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [issueId, status, summary]);
  } else {
    await query('UPDATE issues SET email_status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [issueId, status]);
  }
  console.log(`Simulated email sent to ${departmentEmail} for issue ${issueId}`);
  if (summary) {
    console.log(`Email summary for issue ${issueId}: ${summary}`);
  }
  return status;
}

module.exports = { simulateSendEmail };
