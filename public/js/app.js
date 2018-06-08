const CURRENT_CHANNEL = location.pathname.slice(1);

const websocket = new WebSocket(
    location.origin.replace(/^http/, "ws"),
    "protocolOne"
);

const $chat = $(".chat-history");
const $messageTemplate = $("#message_template");
const $chatFeedback = $(".chat-feedback");
const $messageInput = $("#message_input");
$("#channel_name").text(CURRENT_CHANNEL);

const delay = (function() {
    let timer = 0;
    return function(callback, ms) {
        clearTimeout(timer);
        timer = setTimeout(callback, ms);
    };
})();

$messageInput.on("keydown", () => {
    sendMessage("typing", {});
});

$messageInput.on("keyup", () => {
    delay(() => {
        $chatFeedback.text("");
    }, 1000);
});

$("#send_message").on("click", e => {
    e.preventDefault();
    sendMessage("message", { message: $messageInput.val() });
});

websocket.addEventListener("open", () => {
    sendMessage("subscribe", { username: "USERNAME" });
});

websocket.addEventListener("message", event => {
    const message = JSON.parse(event.data);

    if (message.channel != CURRENT_CHANNEL) {
        throw new Error("User not allowed to send message in this channel");
        return;
    }

    switch (message.type) {
        case "message":
            const $newMessage = $messageTemplate.clone();
            $newMessage.removeClass('hidden');
            $newMessage.find(".chat-time").text(message.payload.date);
            $newMessage.find(".name").text(message.payload.username);
            $newMessage.find(".message").text(message.payload.message);

            $chat.append($newMessage);
            $chat.append("<hr>");

            $messageInput.val('');
            break;
        case "typing":
            $chatFeedback.text("Someone is writting");
            break;
        default:
            break;
    }
});

function sendMessage(type, payload) {
    const message = { type, payload, channel: CURRENT_CHANNEL };
    websocket.send(JSON.stringify(message));
}
