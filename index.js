const PostalMime = require("postal-mime");
const { convert } = require('html-to-text');

// It's 4096
const DISCORD_EMBED_LIMIT = 4096;
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
    let emailText = email.text;
    if (!emailText) {
      // If there is no text, try to get the text from the html
      emailText = convert(email.html);
    }
// The overall limit is 6000 characters, and we limit the embed body to 4096 characters, so the rest has ~1900 characters to work with
    let embedBody = JSON.stringify({
      embeds: [
        {
          title: this.trimToLimit(email.subject, 256), // Limit is 256
          description:
          emailText.length > DISCORD_EMBED_LIMIT
              ? `${emailText.substring(
                  0,
                  DISCORD_EMBED_LIMIT - 12
                )}...(TRIMMED)`
              : emailText,
          author: {
            name: `${(this.trimToLimit(email.from.name, 100))}${email.from.name.length > 64 ? "\n" : " "}<${this.trimToLimit(email.from.address, 100)}>`, // Limit of 256 characters, but we will be a bit careful
          },
          footer: {
            text: `This email was sent to ${this.trimToLimit(message.to, 100)}\nEnvelope From: ${this.trimToLimit(message.from, 100)}`, // Limit of 2048 characters, but we will be careful
          },
        },
      ],
    });
    let formData = new FormData();
    formData.append("payload_json", embedBody);
    if (emailText.length > DISCORD_EMBED_LIMIT) {
      let newTextBlob = new Blob([emailText], {
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
    let discordResponse = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      body: formData,
    });
    if (discordResponse.ok == false) {
      console.log(`Discord Webhook Failed: Discord Response: ${discordResponse.status} ${discordResponse.statusText} -> ${await discordResponse.json()} `);
    }
    // You probably will want to forward the mail anyway to an address, in case discord is down,
    // Or you could make it fail if the webhook fails, causing the sending mail server to error out.
    // Or you could do something more complex with adding it to a Queue and retrying sending to Discord, etc
    // For now, I don't really care about those conditions
  },
  trimToLimit(input, limit) {
    return input.length > limit ? `${input.substring(0, limit - 12)}...(TRIMMED)` : input;
  }
};
