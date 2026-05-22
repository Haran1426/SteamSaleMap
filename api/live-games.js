const { handler } = require("../netlify/functions/live-games.js");

module.exports = async function liveGames(req, res) {
    if (req.method !== "GET") {
        res.status(405).json({ error: "method_not_allowed" });
        return;
    }

    const result = await handler({});
    const headers = result.headers || {};

    Object.entries(headers).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    res.status(result.statusCode || 200).send(result.body || "");
};
