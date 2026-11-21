// Same active failure definition for alerts and the order workspace.
exports.communicationFailureFilter = () => ({ supersededBy: null,
  $or: [{ status: "failed" }, { status: "skipped", errorCode: { $ne: "superseded" } }],
});
