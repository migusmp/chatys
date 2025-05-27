export function setupReplyFeature() {
    let replyTo = null;

    const replyContainer = document.getElementById("replyContainer");
    const replyContent = document.getElementById("replyContent");
    const cancelReply = document.getElementById("cancelReply");

    cancelReply.addEventListener("click", () => {
        replyTo = null;
        replyContainer.classList.add("hidden");
        replyContent.textContent = "";
    });

    document.addEventListener("reply", (e) => {
        replyTo = e.detail;
        replyContent.textContent = `Respondiendo a: "${replyTo}"`;
        replyContainer.classList.remove("hidden");
    });
}
