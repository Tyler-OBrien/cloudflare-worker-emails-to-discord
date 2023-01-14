const PostalMime = require("postal-mime");

// It's 2048 or something, but let's just be safe
const DISCORD_EMBED_LIMIT = 2000;
// This may be higher if your server is boosted to level 2, it should be 50MB. If your server is boosted to level 3, it should be 100MB.
const DISCORD_FILE_LIMIT = 8000000;

export default {
  async email(message, env, ctx) {
    if (env.FORWARD_TO_ADDRESS) {
      await message.forward(env.FORWARD_TO_ADDRESS);
    }
    let rawEmail = new Response(message.raw);
    let arrayBuffer = await rawEmail.arrayBuffer();
    const parser = new PostalMime.default();
    const email = await parser.parse(arrayBuffer);
    var embedBody = JSON.stringify({
      embeds: [
        {
          title: `${message.headers.get("subject")}`,
          description:
            email.text.length > DISCORD_EMBED_LIMIT
              ? `${email.text.substring(
                  0,
                  DISCORD_EMBED_LIMIT - 12
                )}...(TRIMMED)`
              : email.text,
          author: {
            name: message.from,
          },
          footer: {
            text: `This email was sent to ${message.to}`,
          },
        },
      ],
    });
    let formData = new FormData();
    formData.append("payload_json", embedBody);
    if (email.text.length > DISCORD_EMBED_LIMIT) {
      var newTextBlob = new Blob([email.text], {
        type: "text/plain",
      });
      // If the text is too big, we need truncate the blob.
      if (newTextBlob.size < DISCORD_FILE_LIMIT) {
        formData.append("files[0]", newTextBlob, "email.txt");
      } else {
        formData.append(
          "files[0]",
          newTextBlob.slice(0, DISCORD_FILE_LIMIT, "text/plain"),
          "email-trimmed.txt"
        );
      }
    }
    var discordResponse = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      body: formData,
    });
    if (discordResponse.ok == false) {
      console.log("Discord Webhook Failed");
      console.log(
        `Discord Response: ${discordResponse.status} ${discordResponse.statusText}`
      );
      console.log(await discordResponse.json());
    }
    // You probably will want to forward the mail anyway to an address, in case discord is down,
    // Or you could make it fail if the webhook fails, causing the sending mail server to error out.
    // Or you could do something more complex with adding it to a Queue and retrying sending to Discord, etc
    // For now, I don't really care about those conditions
  },
};
