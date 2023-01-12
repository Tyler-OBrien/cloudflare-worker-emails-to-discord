import PostalMime from "postal-mime/dist/postal-mime";

// It's 2048 or something, but let's just be safe
const DISCORD_EMBED_LIMIT = 2000;

export default {
  async email(message, env, ctx) {
    if (env.FORWARD_TO_ADDRESS) {
      await message.forward(env.FORWARD_TO_ADDRESS);
    }
    let rawEmail = new Response(message.raw);
    let arrayBuffer = await rawEmail.arrayBuffer();
    const parser = new PostalMime();
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
    await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json;charset=UTF=8",
      },
      body: embedBody,
    });
    // You probably will want to forward the mail anyway to an address, in case discord is down,
    // Or you could make it fail if the webhook fails, causing the sending mail server to error out.
    // Or you could do something more complex with adding it to a Queue and retrying sending to Discord, etc
    // For now, I don't really care about those conditions
  },
};
