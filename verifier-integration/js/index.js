const path = require("path");
const express = require("express");
const { auth, resolver, protocol } = require("@iden3/js-iden3-auth");
const getRawBody = require("raw-body");
const app = express();
const port = 3001;

app.use(express.static("../static"));

// Removed CORS middleware since Caddy is handling it

app.get("/api/sign-in", (req, res) => {
  console.log("get Auth Request");
  getAuthRequest(req, res);
});

app.post("/api/callback", (req, res) => {
  console.log("callback");
  callback(req, res);
});

app.listen(port, () => {
  console.log("server running on port 3001");
});

// Create a map to store the auth requests and their session IDs
const requestMap = new Map();

// GetQR returns auth request
async function getAuthRequest(req, res) {
  // Audience is verifier id
  const hostUrl = "https://talented-top-kite.ngrok-free.app/privado";
  const sessionId = 1;
  const callbackURL = "/api/callback";
  const audience =
    "did:polygonid:polygon:amoy:2qQ68JkRcf3xrHPQPWZei3YeVzHPP58wYNxx2mEouR";

  const uri = `${hostUrl}${callbackURL}?sessionId=${sessionId}`;

  // Generate request for basic authentication
  const request = auth.createAuthorizationRequest("test flow", audience, uri);


  // Add request for a specific proof
  const proofRequest = {
    id: 1,
    circuitId: "credentialAtomicQuerySigV2",
    query: {
      allowedIssuers: ["*"],
      type: "UniquenessCredential",
      context:
        'https://raw.githubusercontent.com/Ash20pk/privado-poc/refs/heads/main/public/schemas/json-ld/UniquenessCredential.jsonld',
      credentialSubject: {
        confidenceScore: {
          $gt: 80 // Prove that confidence score is >= 80
        },
      },
    },
  };
  const scope = request.body.scope ?? [];
  request.body.scope = [...scope, proofRequest];

  // Store auth request in map associated with session ID
  requestMap.set(`${sessionId}`, request);

  return res.status(200).set("Content-Type", "application/json").send(request);
}

// Callback verifies the proof after sign-in callbacks
async function callback(req, res) {
  // Get session ID from request
  const sessionId = req.query.sessionId;

  // get JWZ token params from the post request
  const raw = await getRawBody(req);
  const tokenStr = raw.toString().trim();

  const keyDIR = "../keys";

  const resolvers = {
    ["polygon:amoy"]: new resolver.EthStateResolver(
    "https://rpc-amoy.polygon.technology",
    "0x1a4cC30f2aA0377b0c3bc9848766D90cb4404124"
  ),
  ["privado:main"]: new resolver.EthStateResolver(
    "https://rpc-mainnet.privado.id",
    "0x3C9acB2205Aa72A05F6D77d708b5Cf85FCa3a896"
  )
};

  // fetch authRequest from sessionID
  const authRequest = requestMap.get(`${sessionId}`);

  // EXECUTE VERIFICATION
  const verifier = await auth.Verifier.newVerifier({
    stateResolver: resolvers,
    circuitsDir: path.join(__dirname, keyDIR),
    ipfsGatewayURL: "https://ipfs.io",
  });

  try {
    const opts = {
      AcceptedStateTransitionDelay: 5 * 60 * 1000, // 5 minute
    };
    authResponse = await verifier.fullVerify(tokenStr, authRequest, opts);
  } catch (error) {
    return res.status(500).send(error);
  }
  return res
    .status(200)
    .set("Content-Type", "application/json")
    .send("Verified");
}