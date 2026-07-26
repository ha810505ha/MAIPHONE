export const countUnreadMails = (mails) => (Array.isArray(mails) ? mails : [])
  .filter((mail) => !mail?.read).length;
