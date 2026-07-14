/**
 * Client-side tree builder to organize flat chronological messages into threads.
 * Creates deep copies to avoid mutating React Query cache data.
 * 
 * @param {Array} flatMessages - Chronological array of message objects.
 * @returns {Array} Nested message tree.
 */
export const buildMessageTree = (flatMessages) => {
  if (!flatMessages || flatMessages.length === 0) return [];
  const messageMap = {};

  flatMessages.forEach((msg) => {
    messageMap[msg.id] = { ...msg, replies: [] };
  });

  const rootMessages = [];

  flatMessages.forEach((msg) => {
    const mappedMsg = messageMap[msg.id];
    if (msg.parentId && messageMap[msg.parentId]) {
      messageMap[msg.parentId].replies.push(mappedMsg);
    } else {
      rootMessages.push(mappedMsg);
    }
  });

  return rootMessages;
};
