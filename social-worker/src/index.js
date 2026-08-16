import { prepareSocialThread } from './social-content.js';
import {
  buildLyricPostText,
  normalizeLyricSections,
  selectLyricPassage,
} from './lyric-social.js';
import {
  CUREATION_2026_TOUR_NAME,
  CUREATION_2026_TOUR_SLUG,
  GENERIC_2026_TOUR_SLUG,
  SUMMER_2026_END,
  SUMMER_2026_START,
  chooseTourAssignment,
  cleanCompletedShowNotes,
  findUniqueNormalizedPlaceholder,
  normalizePlaceName,
  relationId,
} from './setlist-merge.js';

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/lib/automation.ts
var SETLIST_JOB_NAME = "setlistfm_daily_sync";
var SETLIST_ENRICHMENT_JOB_NAME = "setlist_note_enrichment";
var SOCIAL_LYRIC_JOB_NAME = "social_lyric_daily";
var SOCIAL_ON_THIS_DAY_SETLIST_JOB_NAME = "social_setlist_on_this_day";
var SOCIAL_POST_EVENT_SETLIST_JOB_NAME = "social_setlist_after_event";
async function startAutomationRun(directus, jobName, checkpointFrom) {
  return directus.create("automation_runs", {
    job_name: jobName,
    status: "running",
    started_at: (/* @__PURE__ */ new Date()).toISOString(),
    checkpoint_from: checkpointFrom ?? null,
    items_created: 0,
    items_updated: 0,
    items_skipped: 0
  });
}
__name(startAutomationRun, "startAutomationRun");
async function completeAutomationRun(directus, runId, result) {
  await directus.update("automation_runs", runId, {
    status: "success",
    finished_at: (/* @__PURE__ */ new Date()).toISOString(),
    checkpoint_to: result.checkpointTo ?? null,
    items_created: result.itemsCreated,
    items_updated: result.itemsUpdated,
    items_skipped: result.itemsSkipped,
    error_message: null
  });
}
__name(completeAutomationRun, "completeAutomationRun");
async function failAutomationRun(directus, runId, error) {
  if (runId === void 0) {
    return;
  }
  await directus.update("automation_runs", runId, {
    status: "failed",
    finished_at: (/* @__PURE__ */ new Date()).toISOString(),
    error_message: errorMessage(error).slice(0, 2e3)
  });
}
__name(failAutomationRun, "failAutomationRun");
function errorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
__name(errorMessage, "errorMessage");

// src/lib/directus.ts
var DirectusError = class extends Error {
  constructor(message, status, responseBody) {
    super(message);
    this.status = status;
    this.responseBody = responseBody;
  }
  static {
    __name(this, "DirectusError");
  }
};
var DirectusClient = class {
  constructor(env) {
    this.env = env;
    this.baseUrl = env.DIRECTUS_URL.replace(/\/+$/, "");
  }
  static {
    __name(this, "DirectusClient");
  }
  baseUrl;
  async request(method, path, params, body) {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      params.forEach((value, key) => url.searchParams.append(key, value));
    }
    const response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${this.env.DIRECTUS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: body === void 0 ? void 0 : JSON.stringify(body)
    });
    const responseText = await response.text();
    if (!response.ok) {
      throw new DirectusError(
        `${method} ${path} failed with ${response.status}`,
        response.status,
        responseText.slice(0, 1e3)
      );
    }
    if (!responseText) {
      return void 0;
    }
    const parsed = JSON.parse(responseText);
    return isRecord(parsed) && "data" in parsed ? parsed.data : parsed;
  }
  async list(collection, options = {}) {
    const params = this.listParams(options);
    return this.request("GET", `/items/${collection}`, params);
  }
  async first(collection, filter, fields) {
    const rows = await this.list(collection, { filter, fields, limit: 1 });
    return rows[0] ?? null;
  }
  async create(collection, data) {
    return this.request("POST", `/items/${collection}`, void 0, data);
  }
  async update(collection, id, data) {
    return this.request(
      "PATCH",
      `/items/${collection}/${encodeURIComponent(String(id))}`,
      void 0,
      data
    );
  }
  async delete(collection, id) {
    await this.request(
      "DELETE",
      `/items/${collection}/${encodeURIComponent(String(id))}`
    );
  }
  async uploadFile(file, metadata = {}) {
    const form = new FormData();
    form.append("file", file);
    Object.entries(metadata).forEach(([key, value]) => form.append(key, value));
    const response = await fetch(`${this.baseUrl}/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.env.DIRECTUS_TOKEN}`
      },
      body: form
    });
    const responseText = await response.text();
    if (!response.ok) {
      throw new DirectusError(
        `POST /files failed with ${response.status}`,
        response.status,
        responseText.slice(0, 1e3)
      );
    }
    const parsed = JSON.parse(responseText);
    return parsed.data;
  }
  assetUrl(fileId) {
    return `${this.baseUrl}/assets/${encodeURIComponent(String(fileId))}`;
  }
  async fieldSet(collection) {
    const params = new URLSearchParams({ limit: "-1" });
    const fields = await this.request(
      "GET",
      `/fields/${collection}`,
      params
    );
    return new Set(fields.map((field) => field.field));
  }
  listParams(options) {
    const params = new URLSearchParams();
    if (options.limit !== void 0) {
      params.set("limit", String(options.limit));
    }
    if (options.page !== void 0) {
      params.set("page", String(options.page));
    }
    if (options.fields?.length) {
      params.set("fields", options.fields.join(","));
    }
    if (options.sort) {
      params.set(
        "sort",
        Array.isArray(options.sort) ? options.sort.join(",") : options.sort
      );
    }
    if (options.filter) {
      appendFilter(params, "filter", options.filter);
    }
    return params;
  }
};
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
__name(isRecord, "isRecord");
function appendFilter(params, prefix, value) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => appendFilter(params, `${prefix}[${index}]`, entry));
    return;
  }
  if (typeof value === "object" && value !== null) {
    Object.entries(value).forEach(([key, nestedValue]) => {
      appendFilter(params, `${prefix}[${key}]`, nestedValue);
    });
    return;
  }
  if (value !== void 0) {
    params.set(prefix, value === null ? "" : String(value));
  }
}
__name(appendFilter, "appendFilter");
function optionalFields(fieldSet, data) {
  return Object.fromEntries(
    Object.entries(data).filter(([field, value]) => fieldSet.has(field) && value !== void 0)
  );
}
__name(optionalFields, "optionalFields");

// src/lib/social.ts
async function publishToSocialChannels(env, text, publish, channels = ["x", "bluesky"], attachments = []) {
  return publishThreadToSocialChannels(env, [text], publish, channels, attachments);
}
__name(publishToSocialChannels, "publishToSocialChannels");
async function publishThreadToSocialChannels(env, posts, publish, channels = ["x", "bluesky"], attachments = []) {
  const sharedPosts = prepareSocialThread(posts);
  if (sharedPosts.length === 0) {
    throw new Error("Social post has no content after links are removed");
  }
  const results = [];
  if (channels.includes("x")) {
    results.push(await publishThreadToX(env, sharedPosts, publish, attachments));
  }
  if (channels.includes("bluesky")) {
    results.push(await publishThreadToBluesky(env, sharedPosts, publish, attachments));
  }
  return results;
}
__name(publishThreadToSocialChannels, "publishThreadToSocialChannels");
async function publishThreadToX(env, posts, publish, attachments = []) {
  const configured = Boolean(
    env.X_CONSUMER_KEY && env.X_CONSUMER_SECRET && env.X_ACCESS_TOKEN && env.X_ACCESS_TOKEN_SECRET
  );
  if (!configured) {
    return { channel: "x", configured: false, published: false };
  }
  if (!publish) {
    return { channel: "x", configured: true, published: false, postCount: posts.length };
  }
  const xAttachments = xPublishableAttachments(attachments);
  const selectedVideo = attachments.find(isPublishableVideo);
  if (selectedVideo && videoOverLimit(selectedVideo, 120) && xAttachments.length === 0) {
    return {
      channel: "x",
      configured: true,
      published: false,
      error: `X cannot post this video on the current account because it is ${formatDuration(selectedVideo.durationSeconds || 0)}. X rejected videos longer than 2 minutes for this account. Select the thumbnail image or trim the video.`
    };
  }
  const mediaIds = [];
  for (const attachment of xAttachments) {
    const upload = await uploadXMedia(env, attachment);
    if (!upload.mediaId) {
      return {
        channel: "x",
        configured: true,
        published: false,
        error: upload.error || "X media upload failed"
      };
    }
    mediaIds.push(upload.mediaId);
  }
  let lastTweetId;
  let firstTweetId;
  let posted = 0;
  for (const post of posts) {
    const result = await publishXPost(env, post, lastTweetId, posted === 0 ? mediaIds : []);
    if (!result.published) {
      return {
        ...result,
        published: posted > 0,
        postCount: posted,
        id: firstTweetId,
        error: result.error
      };
    }
    lastTweetId = result.id;
    firstTweetId ??= result.id;
    posted += 1;
  }
  return {
    channel: "x",
    configured: true,
    published: posted > 0,
    postCount: posted,
    id: firstTweetId
  };
}
__name(publishThreadToX, "publishThreadToX");
async function publishXPost(env, text, replyToTweetId, mediaIds = []) {
  const endpoint = "https://api.x.com/2/tweets";
  const payload = { text };
  if (replyToTweetId) {
    payload.reply = { in_reply_to_tweet_id: replyToTweetId };
  }
  if (mediaIds.length > 0) {
    payload.media = { media_ids: mediaIds };
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: await oauthHeader(env, "POST", endpoint),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const responseBody = await response.text();
  if (!response.ok) {
    return {
      channel: "x",
      configured: true,
      published: false,
      error: `X returned ${response.status}: ${responseBody.slice(0, 300)}`
    };
  }
  const parsed = JSON.parse(responseBody);
  return {
    channel: "x",
    configured: true,
    published: true,
    id: parsed.data?.id
  };
}
__name(publishXPost, "publishXPost");
async function uploadXMedia(env, attachment) {
  if (isPublishableVideo(attachment)) {
    if (attachment.durationSeconds && attachment.durationSeconds > 120) {
      return {
        error: `X cannot post this video on the current account because it is ${formatDuration(attachment.durationSeconds)}. X rejected videos longer than 2 minutes for this account.`
      };
    }
    return uploadXChunkedVideo(env, attachment);
  }
  const endpoint = "https://upload.twitter.com/1.1/media/upload.json";
  const form = new FormData();
  form.append(
    "media",
    new File([attachment.data], attachment.filename || "cureation-media.jpg", {
      type: attachment.contentType
    })
  );
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: await oauthHeader(env, "POST", endpoint)
    },
    body: form
  });
  const responseBody = await response.text();
  if (!response.ok) {
    return { error: `X media upload returned ${response.status}: ${responseBody.slice(0, 300)}` };
  }
  const parsed = JSON.parse(responseBody);
  return parsed.media_id_string ? { mediaId: parsed.media_id_string } : { error: "X media upload did not return media_id_string" };
}
__name(uploadXMedia, "uploadXMedia");
async function uploadXChunkedVideo(env, attachment) {
  const endpoint = "https://upload.twitter.com/1.1/media/upload.json";
  const initForm = new FormData();
  initForm.append("command", "INIT");
  initForm.append("total_bytes", String(attachment.data.size));
  initForm.append("media_type", "video/mp4");
  initForm.append("media_category", "tweet_video");
  const initResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: await oauthHeader(env, "POST", endpoint)
    },
    body: initForm
  });
  const initText = await initResponse.text();
  if (!initResponse.ok) {
    return { error: `X video INIT returned ${initResponse.status}: ${initText.slice(0, 300)}` };
  }
  const init = JSON.parse(initText);
  const mediaId = init.media_id_string;
  if (!mediaId) {
    return { error: "X video INIT did not return media_id_string" };
  }
  const chunkSize = 4 * 1024 * 1024;
  for (let offset = 0, segmentIndex = 0; offset < attachment.data.size; offset += chunkSize, segmentIndex += 1) {
    const chunk = attachment.data.slice(offset, Math.min(offset + chunkSize, attachment.data.size), "video/mp4");
    const appendForm = new FormData();
    appendForm.append("command", "APPEND");
    appendForm.append("media_id", mediaId);
    appendForm.append("segment_index", String(segmentIndex));
    appendForm.append(
      "media",
      new File([chunk], attachment.filename || `cureation-video-${segmentIndex}.mp4`, {
        type: "video/mp4"
      })
    );
    const appendResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: await oauthHeader(env, "POST", endpoint)
      },
      body: appendForm
    });
    const appendText = await appendResponse.text();
    if (!appendResponse.ok) {
      return { error: `X video APPEND ${segmentIndex} returned ${appendResponse.status}: ${appendText.slice(0, 300)}` };
    }
  }
  const finalizeForm = new FormData();
  finalizeForm.append("command", "FINALIZE");
  finalizeForm.append("media_id", mediaId);
  const finalizeResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: await oauthHeader(env, "POST", endpoint)
    },
    body: finalizeForm
  });
  const finalizeText = await finalizeResponse.text();
  if (!finalizeResponse.ok) {
    return { error: `X video FINALIZE returned ${finalizeResponse.status}: ${finalizeText.slice(0, 300)}` };
  }
  const finalized = JSON.parse(finalizeText);
  const processing = await waitForXMediaProcessing(env, mediaId, finalized.processing_info);
  return processing.error ? { error: processing.error } : { mediaId };
}
__name(uploadXChunkedVideo, "uploadXChunkedVideo");
async function publishThreadToBluesky(env, posts, publish, attachments = []) {
  const configured = Boolean(env.BLUESKY_HANDLE && env.BLUESKY_APP_PASSWORD);
  if (!configured) {
    return { channel: "bluesky", configured: false, published: false };
  }
  if (!publish) {
    return { channel: "bluesky", configured: true, published: false, postCount: posts.length };
  }
  const sessionResult = await createBlueskySession(env);
  if ("error" in sessionResult) {
    return sessionResult.error;
  }
  const firstPostEmbed = await blueskyFirstPostEmbed(sessionResult.session, attachments);
  if ("error" in firstPostEmbed) {
    return firstPostEmbed.error;
  }
  const embed = firstPostEmbed.embed;
  let rootRef;
  let parentRef;
  let firstRef;
  let posted = 0;
  for (const post of posts) {
    const result = await publishBlueskyPost(
      sessionResult.session,
      post,
      rootRef,
      parentRef,
      posted === 0 ? embed : void 0
    );
    if (!result.published) {
      return {
        ...result,
        published: posted > 0,
        postCount: posted,
        uri: firstRef?.uri,
        cid: firstRef?.cid,
        error: result.error
      };
    }
    const ref = { uri: result.uri || "", cid: result.cid || "" };
    rootRef ??= ref;
    parentRef = ref;
    firstRef ??= ref;
    posted += 1;
  }
  return {
    channel: "bluesky",
    configured: true,
    published: posted > 0,
    postCount: posted,
    uri: firstRef?.uri,
    cid: firstRef?.cid
  };
}
__name(publishThreadToBluesky, "publishThreadToBluesky");
async function createBlueskySession(env) {
  const pds = trimTrailingSlash(env.BLUESKY_PDS_URL || "https://bsky.social");
  const handle = normalizeBlueskyHandle(env.BLUESKY_HANDLE || "");
  const sessionResponse = await fetch(`${pds}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: handle,
      password: env.BLUESKY_APP_PASSWORD
    })
  });
  const sessionText = await sessionResponse.text();
  if (!sessionResponse.ok) {
    return {
      error: {
        channel: "bluesky",
        configured: true,
        published: false,
        error: `Bluesky session returned ${sessionResponse.status}: ${sessionText.slice(0, 300)}`
      }
    };
  }
  const session = JSON.parse(sessionText);
  if (!session.accessJwt) {
    return {
      error: {
        channel: "bluesky",
        configured: true,
        published: false,
        error: "Bluesky session did not return accessJwt"
      }
    };
  }
  return {
    session: {
      pds,
      accessJwt: session.accessJwt,
      repo: session.did || handle
    }
  };
}
__name(createBlueskySession, "createBlueskySession");
async function publishBlueskyPost(session, text, rootRef, parentRef, embed) {
  const record = {
    "$type": "app.bsky.feed.post",
    text,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (embed) {
    record.embed = embed;
  }
  if (rootRef && parentRef) {
    record.reply = {
      root: rootRef,
      parent: parentRef
    };
  }
  const postResponse = await fetch(`${session.pds}/xrpc/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      repo: session.repo,
      collection: "app.bsky.feed.post",
      record
    })
  });
  const postText = await postResponse.text();
  if (!postResponse.ok) {
    return {
      channel: "bluesky",
      configured: true,
      published: false,
      error: `Bluesky post returned ${postResponse.status}: ${postText.slice(0, 300)}`
    };
  }
  const post = JSON.parse(postText);
  return {
    channel: "bluesky",
    configured: true,
    published: true,
    uri: post.uri,
    cid: post.cid
  };
}
__name(publishBlueskyPost, "publishBlueskyPost");
async function blueskyFirstPostEmbed(session, attachments) {
  const video = attachments.find(isPublishableVideo);
  const videoAction = videoLimitFallback(video, 60);
  if (videoAction === "fallback_to_images" && attachments.filter(isPublishableImage).length === 0) {
    return {
      error: {
        channel: "bluesky",
        configured: true,
        published: false,
        error: `Bluesky supports videos up to 1 minute. This video is ${formatDuration(video?.durationSeconds || 0)}. Select the thumbnail image or trim the video.`
      }
    };
  }
  if (video && videoAction !== "fallback_to_images") {
    const upload = await uploadBlueskyVideo(session, video);
    if (!upload.embed) {
      return {
        error: {
          channel: "bluesky",
          configured: true,
          published: false,
          error: upload.error || "Bluesky video upload failed"
        }
      };
    }
    return { embed: upload.embed };
  }
  const images = [];
  for (const attachment of attachments.filter(isPublishableImage).slice(0, 4)) {
    const upload = await uploadBlueskyImage(session, attachment);
    if (!upload.image) {
      return {
        error: {
          channel: "bluesky",
          configured: true,
          published: false,
          error: upload.error || "Bluesky image upload failed"
        }
      };
    }
    images.push(upload.image);
  }
  return images.length > 0 ? {
    embed: {
      "$type": "app.bsky.embed.images",
      images
    }
  } : {};
}
__name(blueskyFirstPostEmbed, "blueskyFirstPostEmbed");
async function uploadBlueskyImage(session, attachment) {
  const response = await fetch(`${session.pds}/xrpc/com.atproto.repo.uploadBlob`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      "Content-Type": attachment.contentType
    },
    body: attachment.data
  });
  const responseBody = await response.text();
  if (!response.ok) {
    return { error: `Bluesky image upload returned ${response.status}: ${responseBody.slice(0, 300)}` };
  }
  const parsed = JSON.parse(responseBody);
  return parsed.blob ? { image: { alt: attachment.alt || "", image: parsed.blob } } : { error: "Bluesky image upload did not return a blob" };
}
__name(uploadBlueskyImage, "uploadBlueskyImage");
async function uploadBlueskyVideo(session, attachment) {
  if (attachment.durationSeconds && attachment.durationSeconds > 60) {
    return {
      error: `Bluesky supports videos up to 1 minute. This video is ${formatDuration(attachment.durationSeconds)}, so it would publish as a broken/missing video.`
    };
  }
  const auth = await createBlueskyVideoServiceAuth(session);
  if (!auth.token) {
    return { error: auth.error || "Bluesky video service auth failed" };
  }
  const uploadUrl = new URL("https://video.bsky.app/xrpc/app.bsky.video.uploadVideo");
  uploadUrl.searchParams.set("did", session.repo);
  uploadUrl.searchParams.set("name", attachment.filename || "cureation-video.mp4");
  const response = await fetch(uploadUrl.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "video/mp4"
    },
    body: attachment.data
  });
  const responseBody = await response.text();
  if (!response.ok) {
    return { error: `Bluesky video upload returned ${response.status}: ${responseBody.slice(0, 300)}` };
  }
  const parsed = JSON.parse(responseBody);
  const processed = await waitForBlueskyVideoBlob(parsed);
  return processed.blob ? {
    embed: {
      "$type": "app.bsky.embed.video",
      video: processed.blob,
      alt: attachment.alt || ""
    }
  } : { error: processed.error || "Bluesky video upload did not return a processed blob" };
}
__name(uploadBlueskyVideo, "uploadBlueskyVideo");
async function createBlueskyVideoServiceAuth(session) {
  const host = new URL(session.pds).hostname;
  const response = await fetch(`${session.pds}/xrpc/com.atproto.server.getServiceAuth`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      aud: `did:web:${host}`,
      lxm: "com.atproto.repo.uploadBlob",
      exp: Math.floor(Date.now() / 1e3) + 60 * 30
    })
  });
  const responseBody = await response.text();
  if (!response.ok) {
    return { error: `Bluesky service auth returned ${response.status}: ${responseBody.slice(0, 300)}` };
  }
  const parsed = JSON.parse(responseBody);
  return parsed.token ? { token: parsed.token } : { error: "Bluesky service auth did not return a token" };
}
__name(createBlueskyVideoServiceAuth, "createBlueskyVideoServiceAuth");
async function waitForBlueskyVideoBlob(initial) {
  let jobStatus = initial.jobStatus || initial;
  if (jobStatus.blob) {
    return { blob: jobStatus.blob };
  }
  if (!jobStatus.jobId) {
    return { error: "Bluesky video upload did not return a jobId" };
  }
  const jobId = jobStatus.jobId;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await delay(1e3);
    const statusUrl = new URL("https://video.bsky.app/xrpc/app.bsky.video.getJobStatus");
    statusUrl.searchParams.set("jobId", jobId);
    const response = await fetch(statusUrl.toString());
    const responseBody = await response.text();
    if (!response.ok) {
      const parsed = parseJsonObject(responseBody);
      const blob = nestedBlob(parsed);
      return blob ? { blob } : { error: `Bluesky video status returned ${response.status}: ${responseBody.slice(0, 300)}` };
    }
    const status = JSON.parse(responseBody);
    jobStatus = status.jobStatus || status;
    if (jobStatus.blob) {
      return { blob: jobStatus.blob };
    }
    if (/failed/i.test(jobStatus.state || "")) {
      return { error: `Bluesky video processing failed: ${jobStatus.error || jobStatus.state}` };
    }
  }
  return { error: "Bluesky video processing did not finish in time. Try again with a shorter video." };
}
__name(waitForBlueskyVideoBlob, "waitForBlueskyVideoBlob");
async function waitForXMediaProcessing(env, mediaId, processingInfo) {
  const endpoint = "https://upload.twitter.com/1.1/media/upload.json";
  let info = processingInfo;
  for (let attempt = 0; info && attempt < 12; attempt += 1) {
    if (info.state === "succeeded") {
      return {};
    }
    if (info.state === "failed") {
      return { error: `X video processing failed: ${info.error?.message || info.error?.name || "unknown error"}` };
    }
    const delaySeconds = Math.max(1, Math.min(Number(info.check_after_secs || 2), 5));
    await delay(delaySeconds * 1e3);
    const statusUrl = new URL(endpoint);
    statusUrl.searchParams.set("command", "STATUS");
    statusUrl.searchParams.set("media_id", mediaId);
    const statusResponse = await fetch(statusUrl.toString(), {
      headers: {
        Authorization: await oauthHeader(env, "GET", statusUrl.toString())
      }
    });
    const statusText = await statusResponse.text();
    if (!statusResponse.ok) {
      return { error: `X video STATUS returned ${statusResponse.status}: ${statusText.slice(0, 300)}` };
    }
    const status = JSON.parse(statusText);
    info = status.processing_info;
  }
  return info ? { error: "X video processing did not complete before the publish request timed out. Try publishing the same draft again." } : {};
}
__name(waitForXMediaProcessing, "waitForXMediaProcessing");
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
__name(delay, "delay");
function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}
__name(parseJsonObject, "parseJsonObject");
function nestedBlob(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value;
  if (record.blob && typeof record.blob === "object") {
    return record.blob;
  }
  for (const nested of Object.values(record)) {
    const blob = nestedBlob(nested);
    if (blob) return blob;
  }
  return null;
}
__name(nestedBlob, "nestedBlob");
function isPublishableImage(attachment) {
  return /^image\/(jpeg|jpg|png|webp|gif)$/i.test(attachment.contentType);
}
__name(isPublishableImage, "isPublishableImage");
function isPublishableVideo(attachment) {
  return /^video\/mp4$/i.test(attachment.contentType);
}
__name(isPublishableVideo, "isPublishableVideo");
function xPublishableAttachments(attachments) {
  const video = attachments.find(isPublishableVideo);
  const images = attachments.filter(isPublishableImage).slice(0, 4);
  const videoAction = videoLimitFallback(video, 120);
  if (!video) return images;
  if (videoAction === "fallback_to_images") return images;
  if (videoAction === "error") return [video];
  return [video];
}
__name(xPublishableAttachments, "xPublishableAttachments");
function formatDuration(seconds) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}
__name(formatDuration, "formatDuration");
function videoLimitFallback(video, maxSeconds) {
  if (!videoOverLimit(video, maxSeconds)) {
    return "none";
  }
  return "fallback_to_images";
}
__name(videoLimitFallback, "videoLimitFallback");
function videoOverLimit(video, maxSeconds) {
  return Boolean(video?.durationSeconds && video.durationSeconds > maxSeconds);
}
__name(videoOverLimit, "videoOverLimit");
async function oauthHeader(env, method, url) {
  const parsedUrl = new URL(url);
  const signatureUrl = `${parsedUrl.origin}${parsedUrl.pathname}`;
  const params = {
    oauth_consumer_key: env.X_CONSUMER_KEY || "",
    oauth_nonce: randomNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1e3)),
    oauth_token: env.X_ACCESS_TOKEN || "",
    oauth_version: "1.0"
  };
  parsedUrl.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  const parameterString = Object.entries(params).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`).join("&");
  const signatureBase = [
    method.toUpperCase(),
    percentEncode(signatureUrl),
    percentEncode(parameterString)
  ].join("&");
  const signingKey = `${percentEncode(env.X_CONSUMER_SECRET || "")}&${percentEncode(
    env.X_ACCESS_TOKEN_SECRET || ""
  )}`;
  params.oauth_signature = await hmacSha1Base64(signingKey, signatureBase);
  return `OAuth ${Object.entries(params).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`).join(", ")}`;
}
__name(oauthHeader, "oauthHeader");
async function hmacSha1Base64(key, value) {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(value));
  return bytesToBase64(new Uint8Array(signature));
}
__name(hmacSha1Base64, "hmacSha1Base64");
function percentEncode(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}
__name(percentEncode, "percentEncode");
function randomNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(randomNonce, "randomNonce");
function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}
__name(bytesToBase64, "bytesToBase64");
function normalizeBlueskyHandle(handle) {
  return handle.includes(".") ? handle : `${handle}.bsky.social`;
}
__name(normalizeBlueskyHandle, "normalizeBlueskyHandle");
function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
__name(trimTrailingSlash, "trimTrailingSlash");

// src/lib/socialDrafts.ts
var MAX_DOWNLOAD_MB = 50;
var MAX_DOWNLOAD_BYTES = MAX_DOWNLOAD_MB * 1024 * 1024;
var PUBLIC_PAGE_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
var AUTOMATION_USER_AGENT = "CureationAutomation/1.0";
async function previewSocialMediaDraft(env, input) {
  const normalized = normalizeInput(input);
  assertSupportedSource(normalized.sourceUrl);
  const preview = applyMediaSelection(
    await resolveSourcePreview(env, normalized.sourceUrl),
    normalized.selectedMediaKeys
  );
  const media = await checkMediaUrls(candidateUrls(preview, normalized.mediaUrls));
  return {
    jobName: "social_media_draft_preview",
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    details: buildDetails(normalized, preview, media)
  };
}
__name(previewSocialMediaDraft, "previewSocialMediaDraft");
async function createSocialMediaDraft(env, input) {
  const normalized = normalizeInput(input);
  if (!normalized.rightsConfirmed) {
    throw new Error("Confirm you own or have permission to reuse the media before creating a draft.");
  }
  assertSupportedSource(normalized.sourceUrl);
  const directus = new DirectusClient(env);
  const preview = applyMediaSelection(
    await resolveSourcePreview(env, normalized.sourceUrl),
    normalized.selectedMediaKeys
  );
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const filenamePrefix = filenamePrefixFor(new Date(now));
  const downloadedFiles = await downloadMediaToDirectus(
    directus,
    preview,
    normalized.mediaUrls,
    filenamePrefix
  );
  const media = await checkMediaUrls(candidateUrls(preview, normalized.mediaUrls));
  const caption = normalized.caption || defaultCaption(preview);
  const draft = await directus.create("social_media_drafts", {
    source_url: normalized.sourceUrl,
    source_platform: preview.platform,
    source_type: preview.type,
    source_author: preview.author ?? null,
    source_title: preview.title ?? null,
    source_description: preview.description ?? null,
    source_caption: preview.caption ?? null,
    source_embed_html: preview.embedHtml ?? null,
    source_thumbnail_url: preview.thumbnailUrl ?? null,
    media_type: mediaTypeFor(downloadedFiles, preview),
    filename_prefix: filenamePrefix,
    media_urls: media,
    downloaded_files: downloadedFiles,
    caption,
    channels: normalized.channels,
    status: "draft",
    rights_confirmed: normalized.rightsConfirmed,
    downloaded_at: now,
    created_at: now,
    updated_at: now,
    notes: normalized.notes || null,
    error_message: preview.warnings.length > 0 ? preview.warnings.join("\n") : null
  });
  return {
    jobName: "social_media_draft_create",
    itemsCreated: 1,
    itemsUpdated: 0,
    itemsSkipped: 0,
    details: {
      draftId: draft.id,
      ...buildDetails(normalized, preview, media, downloadedFiles),
      caption
    }
  };
}
__name(createSocialMediaDraft, "createSocialMediaDraft");
async function publishSocialMediaDraft(env, input) {
  const publishInput = normalizePublishInput(input);
  const directus = new DirectusClient(env);
  const draft = await directus.first(
    "social_media_drafts",
    { id: { _eq: publishInput.draftId } },
    ["id", "caption", "channels", "downloaded_files"]
  );
  if (!draft) {
    throw new Error(`Draft ${publishInput.draftId} was not found`);
  }
  const selectedChannels = normalizeChannels(publishInput.channels || draft.channels);
  const requestedChannels = selectedChannels.filter((channel) => channel === "x" || channel === "bluesky");
  const unsupportedChannels = selectedChannels.filter((channel) => channel === "instagram");
  if (requestedChannels.length === 0) {
    throw new Error("No currently publishable channels selected. X and Bluesky are supported in this pass.");
  }
  const caption = draft.caption?.trim();
  if (!caption) {
    throw new Error("Draft has no caption to publish");
  }
  const downloadedCount = downloadedMediaCount(draft.downloaded_files);
  const attachments = await draftMediaAttachments(env, draft.downloaded_files, caption);
  const mediaNote = downloadedCount > 0 ? publishMediaNote(attachments) : null;
  const unsupportedNote = unsupportedChannels.length > 0 ? `Not published to unsupported channels yet: ${unsupportedChannels.join(", ")}.` : null;
  const results = await publishToSocialChannels(env, caption, true, requestedChannels, attachments);
  const allPublished = unsupportedChannels.length === 0 && results.every((entry) => entry.published && !entry.error);
  await directus.update("social_media_drafts", draft.id, {
    status: allPublished ? "published" : "partial",
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    error_message: [
      mediaNote,
      unsupportedNote,
      ...results.map((entry) => entry.error).filter(Boolean)
    ].filter(Boolean).join("\n") || null
  });
  return {
    jobName: "social_media_draft_publish",
    itemsCreated: results.filter((entry) => entry.published).length,
    itemsUpdated: 1,
    itemsSkipped: selectedChannels.length - results.filter((entry) => entry.published).length,
    details: {
      draftId: draft.id,
      channels: selectedChannels,
      publishableChannels: requestedChannels,
      unsupportedChannels,
      mediaNote,
      unsupportedNote,
      attachments: attachments.map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        bytes: attachment.data.size
      })),
      results
    }
  };
}
__name(publishSocialMediaDraft, "publishSocialMediaDraft");
async function beginSocialMediaDraftPublish(env, input) {
  const publishInput = normalizePublishInput(input);
  const directus = new DirectusClient(env);
  const draft = await directus.first(
    "social_media_drafts",
    { id: { _eq: publishInput.draftId } },
    ["id", "caption", "channels", "status"]
  );
  if (!draft) {
    throw new Error(`Draft ${publishInput.draftId} was not found`);
  }
  const selectedChannels = normalizeChannels(publishInput.channels || draft.channels);
  const requestedChannels = selectedChannels.filter((channel) => channel === "x" || channel === "bluesky");
  const unsupportedChannels = selectedChannels.filter((channel) => channel === "instagram");
  if (requestedChannels.length === 0) {
    throw new Error("No currently publishable channels selected. X and Bluesky are supported in this pass.");
  }
  if (!draft.caption?.trim()) {
    throw new Error("Draft has no caption to publish");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await directus.update("social_media_drafts", draft.id, {
    status: "publishing",
    updated_at: now,
    error_message: [
      "Publishing started. Video uploads can take a few minutes.",
      unsupportedChannels.length > 0 ? `Not publishing unsupported channels yet: ${unsupportedChannels.join(", ")}.` : null
    ].filter(Boolean).join("\n")
  });
  return {
    jobName: "social_media_draft_publish_start",
    itemsCreated: 0,
    itemsUpdated: 1,
    itemsSkipped: unsupportedChannels.length,
    details: {
      draftId: draft.id,
      status: "publishing",
      channels: selectedChannels,
      publishableChannels: requestedChannels,
      unsupportedChannels,
      startedAt: now
    }
  };
}
__name(beginSocialMediaDraftPublish, "beginSocialMediaDraftPublish");
async function getSocialMediaDraftStatus(env, input) {
  const publishInput = normalizePublishInput(input);
  const directus = new DirectusClient(env);
  const draft = await directus.first(
    "social_media_drafts",
    { id: { _eq: publishInput.draftId } },
    ["id", "status", "channels", "downloaded_files", "error_message", "updated_at"]
  );
  if (!draft) {
    throw new Error(`Draft ${publishInput.draftId} was not found`);
  }
  return {
    jobName: "social_media_draft_status",
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    details: {
      draftId: draft.id,
      status: draft.status || "draft",
      channels: normalizeChannels(draft.channels),
      downloadedCount: downloadedMediaCount(draft.downloaded_files),
      errorMessage: draft.error_message || null,
      updatedAt: draft.updated_at || null
    }
  };
}
__name(getSocialMediaDraftStatus, "getSocialMediaDraftStatus");
async function markSocialMediaDraftPublishFailed(env, input, error) {
  const publishInput = normalizePublishInput(input);
  const directus = new DirectusClient(env);
  await directus.update("social_media_drafts", publishInput.draftId, {
    status: "failed",
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    error_message: errorMessageText(error)
  });
}
__name(markSocialMediaDraftPublishFailed, "markSocialMediaDraftPublishFailed");
async function resolveSourcePreview(env, sourceUrl) {
  const platform = detectPlatform(sourceUrl);
  if (platform === "x") {
    return xPreview(sourceUrl);
  }
  if (platform === "instagram") {
    return instagramPreview(env, sourceUrl);
  }
  if (platform === "facebook") {
    return metaOembed(env, sourceUrl, "facebook");
  }
  return genericOpenGraph(sourceUrl);
}
__name(resolveSourcePreview, "resolveSourcePreview");
async function instagramPreview(env, sourceUrl) {
  const [publicPage, embed, oembed] = await Promise.all([
    instagramPublicPagePreview(sourceUrl).catch(
      (error) => instagramWarningPreview(sourceUrl, "public_page", `Instagram public page extraction failed: ${errorMessageText(error)}`)
    ),
    instagramEmbedPreview(sourceUrl).catch(
      (error) => instagramWarningPreview(sourceUrl, "embed", `Instagram embed extraction failed: ${errorMessageText(error)}`)
    ),
    metaOembed(env, sourceUrl, "instagram").catch(
      (error) => instagramWarningPreview(sourceUrl, "oembed", `Instagram oEmbed extraction failed: ${errorMessageText(error)}`)
    )
  ]);
  const embedMediaCandidates = publicPage.mediaCandidates.some((candidate) => candidate.mediaType === "image") ? embed.mediaCandidates.filter((candidate) => candidate.mediaType !== "image") : embed.mediaCandidates;
  const mediaCandidates2 = dedupeMediaCandidates([
    ...embedMediaCandidates,
    ...publicPage.mediaCandidates,
    ...oembed.mediaCandidates
  ]);
  return {
    sourceUrl,
    platform: "instagram",
    type: embed.mediaCandidates.length > 0 ? embed.type : publicPage.mediaCandidates.length > 0 ? publicPage.type : oembed.type,
    author: publicPage.author || embed.author || oembed.author || null,
    title: publicPage.title || oembed.title || embed.title || null,
    caption: embed.caption || publicPage.caption || oembed.caption || null,
    description: publicPage.description || oembed.description || embed.description || null,
    embedHtml: oembed.embedHtml || embed.embedHtml || publicPage.embedHtml || null,
    thumbnailUrl: publicPage.thumbnailUrl || oembed.thumbnailUrl || embed.thumbnailUrl || mediaCandidates2[0]?.url || null,
    postedAt: embed.postedAt || publicPage.postedAt || oembed.postedAt || null,
    mediaCandidates: mediaCandidates2,
    warnings: [...publicPage.warnings, ...embed.warnings, ...oembed.warnings]
  };
}
__name(instagramPreview, "instagramPreview");
function instagramWarningPreview(sourceUrl, type, warning) {
  return {
    sourceUrl,
    platform: "instagram",
    type,
    author: null,
    title: null,
    caption: null,
    description: null,
    embedHtml: null,
    thumbnailUrl: null,
    postedAt: null,
    mediaCandidates: [],
    warnings: [warning]
  };
}
__name(instagramWarningPreview, "instagramWarningPreview");
async function instagramPublicPagePreview(sourceUrl) {
  const response = await fetch(sourceUrl, {
    headers: publicHtmlHeaders()
  });
  const html2 = await response.text();
  if (!response.ok) {
    return {
      sourceUrl,
      platform: "instagram",
      type: "public_page",
      mediaCandidates: [],
      warnings: [`Instagram public page returned ${response.status}: ${html2.slice(0, 250)}`]
    };
  }
  const image = og(html2, "og:image") || metaName(html2, "twitter:image");
  const title = og(html2, "og:title") || metaName(html2, "twitter:title") || titleTag(html2);
  const description = og(html2, "og:description") || metaName(html2, "description");
  const caption = instagramCaptionFromTitle(title) || instagramCaptionFromDescription(description);
  return {
    sourceUrl,
    platform: "instagram",
    type: "public_page",
    author: instagramAuthorFromTitle(title),
    title,
    caption,
    description,
    embedHtml: null,
    thumbnailUrl: image,
    mediaCandidates: image ? [{ url: image, mediaType: "image", contentType: "image/jpeg", source: "instagram_open_graph_image" }] : [],
    warnings: image ? [] : ["No Instagram OpenGraph image was found in the public page data."]
  };
}
__name(instagramPublicPagePreview, "instagramPublicPagePreview");
async function instagramEmbedPreview(sourceUrl) {
  const embedUrl = instagramEmbedUrl(sourceUrl);
  if (!embedUrl) {
    return {
      sourceUrl,
      platform: "instagram",
      type: "embed",
      mediaCandidates: [],
      warnings: ["Could not find an Instagram shortcode in the URL."]
    };
  }
  const response = await fetch(embedUrl, {
    headers: publicHtmlHeaders()
  });
  const html2 = await response.text();
  if (!response.ok) {
    return {
      sourceUrl,
      platform: "instagram",
      type: "embed",
      mediaCandidates: [],
      warnings: [`Instagram embed page returned ${response.status}: ${html2.slice(0, 250)}`]
    };
  }
  const videoUrl = instagramEscapedJsonField(html2, "video_url");
  const imageUrl = instagramEscapedJsonField(html2, "display_url") || instagramEscapedJsonField(html2, "thumbnail_src");
  const caption = instagramEmbedCaption(html2);
  const mediaCandidates2 = [];
  if (videoUrl) {
    mediaCandidates2.push({
      url: videoUrl,
      mediaType: "video",
      contentType: "video/mp4",
      source: "instagram_embed_video",
      durationSeconds: instagramVideoDurationSeconds(videoUrl) ?? void 0
    });
  }
  if (imageUrl) {
    mediaCandidates2.push({ url: imageUrl, mediaType: "image", contentType: "image/jpeg", source: "instagram_embed_image" });
  }
  return {
    sourceUrl,
    platform: "instagram",
    type: videoUrl ? "embed_video" : "embed",
    author: null,
    title: null,
    caption,
    description: null,
    embedHtml: null,
    thumbnailUrl: imageUrl,
    mediaCandidates: mediaCandidates2,
    warnings: mediaCandidates2.length > 0 ? [] : ["No downloadable Instagram media was found in the public embed data."]
  };
}
__name(instagramEmbedPreview, "instagramEmbedPreview");
async function xPreview(sourceUrl) {
  const [scraped, oembed] = await Promise.all([
    xPublicPagePreview(sourceUrl).catch(
      (error) => xWarningPreview(sourceUrl, "public_page", `X public page extraction failed: ${errorMessageText(error)}`)
    ),
    xOembed(sourceUrl).catch(
      (error) => xWarningPreview(sourceUrl, "oembed", `X oEmbed extraction failed: ${errorMessageText(error)}`)
    )
  ]);
  return {
    sourceUrl,
    platform: "x",
    type: scraped.mediaCandidates.length > 0 ? scraped.type : oembed.type,
    author: scraped.author || oembed.author || null,
    title: scraped.title || oembed.title || null,
    caption: scraped.caption || oembed.caption || null,
    description: scraped.description || oembed.description || null,
    embedHtml: oembed.embedHtml || scraped.embedHtml || null,
    thumbnailUrl: scraped.thumbnailUrl || oembed.thumbnailUrl || null,
    postedAt: scraped.postedAt || oembed.postedAt || null,
    mediaCandidates: dedupeMediaCandidates([
      ...scraped.mediaCandidates,
      ...oembed.mediaCandidates
    ]),
    warnings: [...scraped.warnings, ...oembed.warnings]
  };
}
__name(xPreview, "xPreview");
function xWarningPreview(sourceUrl, type, warning) {
  return {
    sourceUrl,
    platform: "x",
    type,
    author: null,
    title: null,
    caption: null,
    description: null,
    embedHtml: null,
    thumbnailUrl: null,
    postedAt: null,
    mediaCandidates: [],
    warnings: [warning]
  };
}
__name(xWarningPreview, "xWarningPreview");
async function xPublicPagePreview(sourceUrl) {
  const tweetId = xStatusId(sourceUrl);
  if (!tweetId) {
    return {
      sourceUrl,
      platform: "x",
      type: "public_page",
      mediaCandidates: [],
      warnings: ["Could not find an X status ID in the URL."]
    };
  }
  const response = await fetch(`https://x.com/i/status/${tweetId}`, {
    headers: publicHtmlHeaders()
  });
  const html2 = await response.text();
  if (!response.ok) {
    return {
      sourceUrl,
      platform: "x",
      type: "public_page",
      mediaCandidates: [],
      warnings: [`X public page returned ${response.status}: ${html2.slice(0, 250)}`]
    };
  }
  const state = extractJsonAssignment(html2, "window.__INITIAL_STATE__=");
  if (!state) {
    return {
      sourceUrl,
      platform: "x",
      type: "public_page",
      mediaCandidates: [],
      warnings: ["X public page did not include initial state media data."]
    };
  }
  const root = state;
  const tweet = nestedRecord(root, ["entities", "tweets", "entities", tweetId]);
  if (!tweet) {
    return {
      sourceUrl,
      platform: "x",
      type: "public_page",
      mediaCandidates: [],
      warnings: ["X public page initial state did not include the requested tweet."]
    };
  }
  const userId = stringValue(tweet.user);
  const user = userId ? nestedRecord(root, ["entities", "users", "entities", userId]) : null;
  const media = xTweetMedia(tweet);
  const mediaCandidates2 = xMediaCandidates(media);
  const rawText = stringValue(tweet.full_text) || stringValue(tweet.text);
  const mediaUrls = media.map((entry) => stringValue(entry.url)).filter((entry) => Boolean(entry));
  const caption = rawText ? cleanXText(rawText, mediaUrls) : null;
  return {
    sourceUrl,
    platform: "x",
    type: "public_page",
    author: stringValue(user?.name) || stringValue(user?.screen_name),
    title: null,
    caption,
    description: null,
    embedHtml: null,
    thumbnailUrl: mediaCandidates2[0]?.url || null,
    postedAt: stringValue(tweet.created_at),
    mediaCandidates: mediaCandidates2,
    warnings: mediaCandidates2.length > 0 ? [] : ["No downloadable X media was found in the public page data."]
  };
}
__name(xPublicPagePreview, "xPublicPagePreview");
async function xOembed(sourceUrl) {
  const endpoint = new URL("https://publish.x.com/oembed");
  endpoint.searchParams.set("url", sourceUrl);
  endpoint.searchParams.set("omit_script", "true");
  const response = await fetch(endpoint.toString());
  const text = await response.text();
  if (!response.ok) {
    return {
      sourceUrl,
      platform: "x",
      type: "oembed",
      mediaCandidates: [],
      warnings: [`X oEmbed returned ${response.status}: ${text.slice(0, 250)}`]
    };
  }
  const data = JSON.parse(text);
  const html2 = stringValue(data.html);
  const thumbnailUrl = stringValue(data.thumbnail_url);
  return {
    sourceUrl,
    platform: "x",
    type: String(data.type || "rich"),
    author: stringValue(data.author_name),
    title: stringValue(data.title),
    caption: html2 ? extractXCaption(html2) : null,
    description: null,
    embedHtml: html2,
    thumbnailUrl,
    mediaCandidates: thumbnailUrl ? [{ url: thumbnailUrl, mediaType: "image", source: "x_oembed_thumbnail" }] : [],
    warnings: []
  };
}
__name(xOembed, "xOembed");
async function metaOembed(env, sourceUrl, platform) {
  const endpoint = new URL(
    platform === "instagram" ? "https://graph.facebook.com/v25.0/instagram_oembed" : "https://graph.facebook.com/v25.0/oembed_post"
  );
  endpoint.searchParams.set("url", sourceUrl);
  if (env.META_OEMBED_ACCESS_TOKEN) {
    endpoint.searchParams.set("access_token", env.META_OEMBED_ACCESS_TOKEN);
  }
  const response = await fetch(endpoint.toString());
  const text = await response.text();
  if (!response.ok) {
    return {
      sourceUrl,
      platform,
      type: "oembed",
      mediaCandidates: [],
      warnings: [`Meta oEmbed returned ${response.status}: ${text.slice(0, 250)}`]
    };
  }
  const data = JSON.parse(text);
  const thumbnailUrl = stringValue(data.thumbnail_url);
  return {
    sourceUrl,
    platform,
    type: String(data.type || "rich"),
    author: stringValue(data.author_name),
    title: stringValue(data.title),
    caption: null,
    description: null,
    embedHtml: stringValue(data.html),
    thumbnailUrl,
    mediaCandidates: thumbnailUrl ? [{ url: thumbnailUrl, mediaType: "image", source: "meta_oembed_thumbnail" }] : [],
    warnings: []
  };
}
__name(metaOembed, "metaOembed");
async function genericOpenGraph(sourceUrl) {
  const response = await fetch(sourceUrl, {
    headers: { "User-Agent": AUTOMATION_USER_AGENT }
  });
  const html2 = await response.text();
  if (!response.ok) {
    return {
      sourceUrl,
      platform: "unknown",
      type: "webpage",
      mediaCandidates: [],
      warnings: [`Source URL returned ${response.status}: ${html2.slice(0, 250)}`]
    };
  }
  const image = og(html2, "og:image");
  const description = og(html2, "og:description") || metaName(html2, "description");
  return {
    sourceUrl,
    platform: "unknown",
    type: og(html2, "og:type") || "webpage",
    author: og(html2, "article:author"),
    title: og(html2, "og:title") || titleTag(html2),
    caption: description,
    description,
    embedHtml: null,
    thumbnailUrl: image,
    mediaCandidates: image ? [{ url: image, mediaType: "image", source: "open_graph_image" }] : [],
    warnings: []
  };
}
__name(genericOpenGraph, "genericOpenGraph");
async function downloadMediaToDirectus(directus, preview, userMediaUrls, filenamePrefix) {
  const candidates = mediaCandidates(preview, userMediaUrls).slice(0, 8);
  const downloaded = [];
  for (const [index, candidate] of candidates.entries()) {
    try {
      const response = await fetch(candidate.url, {
        headers: { "User-Agent": PUBLIC_PAGE_USER_AGENT }
      });
      if (!response.ok) {
        downloaded.push({
          sourceUrl: candidate.url,
          ok: false,
          error: `Media download returned ${response.status}`
        });
        continue;
      }
      const contentType = response.headers.get("Content-Type") || candidate.contentType || "";
      if (!/^(image|video)\//i.test(contentType)) {
        downloaded.push({
          sourceUrl: candidate.url,
          ok: false,
          contentType,
          error: "Downloaded URL is not an image or video"
        });
        continue;
      }
      const contentLength = Number(response.headers.get("Content-Length") || 0);
      if (contentLength > MAX_DOWNLOAD_BYTES) {
        downloaded.push({
          sourceUrl: candidate.url,
          ok: false,
          contentType,
          error: `Media is too large. Maximum supported download is ${MAX_DOWNLOAD_MB}MB.`
        });
        continue;
      }
      const blob = await response.blob();
      if (blob.size > MAX_DOWNLOAD_BYTES) {
        downloaded.push({
          sourceUrl: candidate.url,
          ok: false,
          contentType,
          bytes: blob.size,
          error: `Media is too large. Maximum supported download is ${MAX_DOWNLOAD_MB}MB.`
        });
        continue;
      }
      const filename = `${filenamePrefix}-${String(index + 1).padStart(2, "0")}.${extensionFor(
        contentType,
        candidate.url
      )}`;
      const file = new File([blob], filename, { type: contentType });
      const uploaded = await directus.uploadFile(file, { title: filename });
      downloaded.push({
        sourceUrl: candidate.url,
        directusFileId: uploaded.id,
        directusAssetUrl: directus.assetUrl(uploaded.id),
        filename,
        mediaType: mediaKind(contentType),
        contentType,
        durationSeconds: candidate.durationSeconds ?? instagramVideoDurationSeconds(candidate.url) ?? void 0,
        bytes: blob.size,
        ok: true
      });
    } catch (error) {
      downloaded.push({
        sourceUrl: candidate.url,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return downloaded;
}
__name(downloadMediaToDirectus, "downloadMediaToDirectus");
async function checkMediaUrls(mediaUrls) {
  const checks = [];
  for (const url of mediaUrls) {
    checks.push(await checkMediaUrl(url));
  }
  return checks;
}
__name(checkMediaUrls, "checkMediaUrls");
async function checkMediaUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { url, ok: false, error: "Only http(s) media URLs are supported" };
    }
    const head = mediaCheckFromResponse(url, await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": PUBLIC_PAGE_USER_AGENT }
    }));
    if (head.ok) {
      return head;
    }
    const rangedResponse = await fetch(url, {
      headers: {
        "User-Agent": PUBLIC_PAGE_USER_AGENT,
        Range: "bytes=0-0"
      }
    });
    const ranged = mediaCheckFromResponse(url, rangedResponse);
    await rangedResponse.body?.cancel();
    return ranged.ok ? ranged : {
      ...head,
      error: head.error || ranged.error
    };
  } catch (error) {
    return {
      url,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
__name(checkMediaUrl, "checkMediaUrl");
function mediaCheckFromResponse(url, response) {
  const contentType = response.headers.get("Content-Type");
  const allowed = Boolean(contentType && /^(image|video)\//i.test(contentType));
  return {
    url,
    ok: response.ok && allowed,
    contentType,
    contentLength: mediaContentLength(response),
    error: response.ok && !allowed ? "URL is not an image or video response" : void 0
  };
}
__name(mediaCheckFromResponse, "mediaCheckFromResponse");
function mediaContentLength(response) {
  const contentRange = response.headers.get("Content-Range") || "";
  return /\/(\d+)\s*$/.exec(contentRange)?.[1] || response.headers.get("Content-Length");
}
__name(mediaContentLength, "mediaContentLength");
function normalizeInput(input) {
  if (!isRecord2(input)) {
    throw new Error("Expected draft input to be a JSON object");
  }
  const sourceUrl = normalizeHttpUrl(stringInput(input.sourceUrl));
  return {
    sourceUrl,
    caption: stringInput(input.caption).trim(),
    channels: normalizeChannels(input.channels),
    mediaUrls: arrayInput(input.mediaUrls).slice(0, 8).map((entry) => normalizeHttpUrl(String(entry))),
    selectedMediaKeys: Array.isArray(input.selectedMediaKeys) ? input.selectedMediaKeys.map((entry) => stringInput(entry).trim()).filter(Boolean).slice(0, 8) : null,
    rightsConfirmed: input.rightsConfirmed === true,
    notes: stringInput(input.notes).trim()
  };
}
__name(normalizeInput, "normalizeInput");
function normalizePublishInput(input) {
  if (!isRecord2(input)) {
    throw new Error("Expected publish input to be a JSON object");
  }
  const draftId = stringInput(input.draftId || input.id).trim();
  if (!draftId) {
    throw new Error("Missing draftId");
  }
  return {
    draftId,
    channels: input.channels
  };
}
__name(normalizePublishInput, "normalizePublishInput");
function normalizeHttpUrl(value) {
  const parsed = new URL(String(value || "").trim());
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) URLs are supported.");
  }
  return parsed.toString();
}
__name(normalizeHttpUrl, "normalizeHttpUrl");
function normalizeChannels(value) {
  const channels = arrayInput(value).filter(
    (channel) => channel === "x" || channel === "instagram" || channel === "bluesky"
  );
  return channels.length > 0 ? [...new Set(channels)] : ["x", "instagram", "bluesky"];
}
__name(normalizeChannels, "normalizeChannels");
function downloadedMediaCount(value) {
  return downloadedMediaList(value).length;
}
__name(downloadedMediaCount, "downloadedMediaCount");
function downloadedMediaList(value) {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  return Array.isArray(parsed) ? parsed.filter((entry) => isRecord2(entry) && entry.ok === true) : [];
}
__name(downloadedMediaList, "downloadedMediaList");
async function draftMediaAttachments(env, downloadedFiles, caption) {
  const attachments = [];
  for (const file of downloadedMediaList(downloadedFiles).slice(0, 8)) {
    if (!file.directusAssetUrl || !/^(image|video)\//i.test(file.contentType || "")) {
      continue;
    }
    const response = await fetch(file.directusAssetUrl, {
      headers: {
        Authorization: `Bearer ${env.DIRECTUS_TOKEN}`
      }
    });
    if (!response.ok) {
      continue;
    }
    const contentType = attachmentContentType(response.headers.get("Content-Type"), file.contentType);
    if (!/^(image|video)\//i.test(contentType)) {
      continue;
    }
    attachments.push({
      data: await response.blob(),
      contentType,
      filename: file.filename,
      alt: caption.slice(0, 1e3),
      durationSeconds: file.durationSeconds ?? instagramVideoDurationSeconds(file.sourceUrl) ?? void 0
    });
  }
  return attachments;
}
__name(draftMediaAttachments, "draftMediaAttachments");
function attachmentContentType(responseType, storedType) {
  if (responseType && /^(image|video)\//i.test(responseType)) {
    return responseType;
  }
  if (storedType && /^(image|video)\//i.test(storedType)) {
    return storedType;
  }
  return responseType || storedType || "application/octet-stream";
}
__name(attachmentContentType, "attachmentContentType");
function publishMediaNote(attachments) {
  const videoCount = attachments.filter((attachment) => /^video\//i.test(attachment.contentType)).length;
  const imageCount = attachments.filter((attachment) => /^image\//i.test(attachment.contentType)).length;
  if (videoCount > 0) {
    const firstVideo = attachments.find((attachment) => /^video\//i.test(attachment.contentType));
    const duration = firstVideo?.durationSeconds ? ` Duration: ${formatDuration2(firstVideo.durationSeconds)}.` : "";
    return `Prepared ${videoCount} video${videoCount === 1 ? "" : "s"} and ${imageCount} image${imageCount === 1 ? "" : "s"} for X/Bluesky. When a video is present, the first video is used.${duration}`;
  }
  if (imageCount > 0) {
    return `Prepared ${imageCount} image${imageCount === 1 ? "" : "s"} for X/Bluesky.`;
  }
  return "Media files are stored on the draft, but no publishable image or video was available for X/Bluesky.";
}
__name(publishMediaNote, "publishMediaNote");
function formatDuration2(seconds) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}
__name(formatDuration2, "formatDuration");
function mediaCandidates(preview, userMediaUrls) {
  const userCandidates = userMediaUrls.map((url) => ({
    url,
    mediaType: "unknown",
    source: "user_supplied"
  }));
  const seen = /* @__PURE__ */ new Set();
  return [...userCandidates, ...preview.mediaCandidates].filter((candidate) => {
    if (seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
}
__name(mediaCandidates, "mediaCandidates");
function applyMediaSelection(preview, selectedMediaKeys) {
  const keyedCandidates = withMediaSelectionKeys(preview.mediaCandidates);
  if (selectedMediaKeys === null) {
    return {
      ...preview,
      mediaCandidates: keyedCandidates
    };
  }
  const selected = new Set(selectedMediaKeys);
  return {
    ...preview,
    mediaCandidates: keyedCandidates.filter(
      (candidate) => Boolean(candidate.selectionKey && selected.has(candidate.selectionKey))
    )
  };
}
__name(applyMediaSelection, "applyMediaSelection");
function withMediaSelectionKeys(candidates) {
  return candidates.map((candidate, index) => ({
    ...candidate,
    selectionKey: mediaSelectionKey(candidate, index)
  }));
}
__name(withMediaSelectionKeys, "withMediaSelectionKeys");
function mediaSelectionKey(candidate, index) {
  return `${candidate.mediaType}:${candidate.source}:${index}`;
}
__name(mediaSelectionKey, "mediaSelectionKey");
function candidateUrls(preview, userMediaUrls) {
  return mediaCandidates(preview, userMediaUrls).map((candidate) => candidate.url);
}
__name(candidateUrls, "candidateUrls");
function dedupeMediaCandidates(candidates) {
  const seen = /* @__PURE__ */ new Set();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
}
__name(dedupeMediaCandidates, "dedupeMediaCandidates");
function detectPlatform(sourceUrl) {
  const host = new URL(sourceUrl).hostname.replace(/^www\./, "");
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
  if (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.watch") return "facebook";
  if (host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com")) return "x";
  return "unknown";
}
__name(detectPlatform, "detectPlatform");
function assertSupportedSource(sourceUrl) {
  if (detectPlatform(sourceUrl) === "unknown") {
    throw new Error("Use an Instagram, Facebook, or X post URL.");
  }
}
__name(assertSupportedSource, "assertSupportedSource");
function xStatusId(sourceUrl) {
  const match = /\/status(?:es)?\/(\d+)/i.exec(new URL(sourceUrl).pathname);
  return match?.[1] || null;
}
__name(xStatusId, "xStatusId");
function instagramEmbedUrl(sourceUrl) {
  const match = /^\/(p|reels?|tv)\/([^/]+)/i.exec(new URL(sourceUrl).pathname);
  if (!match) return null;
  const kind = match[1].toLowerCase() === "reels" ? "reel" : match[1].toLowerCase();
  return `https://www.instagram.com/${kind}/${match[2]}/embed/captioned/`;
}
__name(instagramEmbedUrl, "instagramEmbedUrl");
function instagramAuthorFromTitle(title) {
  if (!title) return null;
  return /^(.+?)\s+on Instagram:/i.exec(title)?.[1]?.trim() || null;
}
__name(instagramAuthorFromTitle, "instagramAuthorFromTitle");
function instagramCaptionFromTitle(title) {
  if (!title) return null;
  const match = /\son Instagram:\s*"([\s\S]+)"\s*$/i.exec(title);
  return cleanInstagramCaption(match?.[1] || "");
}
__name(instagramCaptionFromTitle, "instagramCaptionFromTitle");
function instagramCaptionFromDescription(description) {
  if (!description) return null;
  const match = /:\s*"([\s\S]+)"\.?\s*$/i.exec(description);
  return cleanInstagramCaption(match?.[1] || "");
}
__name(instagramCaptionFromDescription, "instagramCaptionFromDescription");
function instagramEmbedCaption(html2) {
  const markerIndex = html2.indexOf("edge_media_to_caption");
  if (markerIndex < 0) return null;
  return cleanInstagramCaption(
    instagramEscapedJsonField(html2.slice(markerIndex, markerIndex + 5e3), "text") || ""
  );
}
__name(instagramEmbedCaption, "instagramEmbedCaption");
function instagramVideoDurationSeconds(videoUrl) {
  try {
    const encoded = new URL(videoUrl).searchParams.get("efg");
    if (!encoded) return null;
    const decoded = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const data = JSON.parse(decoded);
    const duration = Number(data.duration_s);
    return Number.isFinite(duration) && duration > 0 ? duration : null;
  } catch {
    return null;
  }
}
__name(instagramVideoDurationSeconds, "instagramVideoDurationSeconds");
function cleanInstagramCaption(value) {
  return value.replace(/[ \t\f\v]+\n/g, "\n").replace(/\n[ \t\f\v]+/g, "\n").replace(/[ \t\f\v]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim() || null;
}
__name(cleanInstagramCaption, "cleanInstagramCaption");
function instagramEscapedJsonField(source, field) {
  const markers = [`\\"${field}\\"`, `"${field}"`];
  for (const marker of markers) {
    const keyIndex = source.indexOf(marker);
    if (keyIndex < 0) continue;
    const colonIndex = source.indexOf(":", keyIndex + marker.length);
    if (colonIndex < 0) continue;
    let cursor = colonIndex + 1;
    while (/\s/.test(source[cursor] || "")) {
      cursor += 1;
    }
    const escapedDelimiter = source[cursor] === "\\" && source[cursor + 1] === '"';
    const plainDelimiter = source[cursor] === '"';
    if (!escapedDelimiter && !plainDelimiter) continue;
    const start = cursor + (escapedDelimiter ? 2 : 1);
    const raw = escapedDelimiter ? readEscapedQuotedValue(source, start) : readPlainQuotedValue(source, start);
    const decoded = decodeEscapedJsonValue(raw);
    if (decoded) return decoded;
  }
  return null;
}
__name(instagramEscapedJsonField, "instagramEscapedJsonField");
function readEscapedQuotedValue(source, start) {
  for (let index = start; index < source.length - 1; index += 1) {
    if (source[index] === "\\" && source[index + 1] === '"' && countBackslashesEndingAt(source, index) === 1) {
      return source.slice(start, index);
    }
  }
  return null;
}
__name(readEscapedQuotedValue, "readEscapedQuotedValue");
function readPlainQuotedValue(source, start) {
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '"' && countBackslashesEndingAt(source, index - 1) % 2 === 0) {
      return source.slice(start, index);
    }
  }
  return null;
}
__name(readPlainQuotedValue, "readPlainQuotedValue");
function decodeEscapedJsonValue(value) {
  if (!value) return null;
  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    try {
      const next = JSON.parse(`"${decoded.replace(/"/g, '\\"')}"`);
      if (typeof next !== "string" || next === decoded) {
        break;
      }
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded.replace(/\\\//g, "/").trim() || null;
}
__name(decodeEscapedJsonValue, "decodeEscapedJsonValue");
function countBackslashesEndingAt(source, index) {
  let count = 0;
  for (let cursor = index; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) {
    count += 1;
  }
  return count;
}
__name(countBackslashesEndingAt, "countBackslashesEndingAt");
function publicHtmlHeaders() {
  return {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "User-Agent": PUBLIC_PAGE_USER_AGENT
  };
}
__name(publicHtmlHeaders, "publicHtmlHeaders");
function extractJsonAssignment(html2, marker) {
  const markerIndex = html2.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = markerIndex + marker.length;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < html2.length; index += 1) {
    const char = html2[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return parseJson(html2.slice(start, index + 1));
      }
    }
  }
  return null;
}
__name(extractJsonAssignment, "extractJsonAssignment");
function nestedRecord(value, path) {
  let current = value;
  for (const key of path) {
    if (!isRecord2(current)) return null;
    current = current[key];
  }
  return isRecord2(current) ? current : null;
}
__name(nestedRecord, "nestedRecord");
function xTweetMedia(tweet) {
  const extended = nestedRecord(tweet, ["extended_entities"]);
  const entities = nestedRecord(tweet, ["entities"]);
  const media = arrayInput(extended?.media).length > 0 ? arrayInput(extended?.media) : arrayInput(entities?.media);
  return media.filter(isRecord2);
}
__name(xTweetMedia, "xTweetMedia");
function xMediaCandidates(media) {
  return media.flatMap((entry) => {
    const type = stringValue(entry.type);
    const imageUrl = stringValue(entry.media_url_https);
    if (type === "photo" && imageUrl) {
      return [{
        url: xOriginalImageUrl(imageUrl),
        mediaType: "image",
        contentType: "image/jpeg",
        source: "x_public_page_photo"
      }];
    }
    if ((type === "video" || type === "animated_gif") && isRecord2(entry.video_info)) {
      const variant = arrayInput(entry.video_info.variants).filter(isRecord2).filter((candidate) => stringValue(candidate.url) && stringValue(candidate.content_type) === "video/mp4").sort((left, right) => numericValue(right.bitrate) - numericValue(left.bitrate))[0];
      const videoUrl = stringValue(variant?.url);
      if (videoUrl) {
        return [{
          url: videoUrl,
          mediaType: "video",
          contentType: "video/mp4",
          source: "x_public_page_video"
        }];
      }
    }
    return [];
  });
}
__name(xMediaCandidates, "xMediaCandidates");
function xOriginalImageUrl(imageUrl) {
  const parsed = new URL(imageUrl);
  const extension = /\.([a-z0-9]+)$/i.exec(parsed.pathname)?.[1];
  if (!parsed.searchParams.has("format") && extension) {
    parsed.pathname = parsed.pathname.replace(/\.[a-z0-9]+$/i, "");
    parsed.searchParams.set("format", extension === "jpg" ? "jpg" : extension.toLowerCase());
  }
  parsed.searchParams.set("name", "orig");
  return parsed.toString();
}
__name(xOriginalImageUrl, "xOriginalImageUrl");
function cleanXText(text, mediaUrls) {
  let cleaned = text;
  for (const url of mediaUrls) {
    cleaned = cleaned.replaceAll(url, "");
  }
  return cleaned.replace(/(?:https?:\/\/t\.co\/\S+|pic\.(?:twitter|x)\.com\/\S+)/gi, "").replace(/[ \t\f\v]+\n/g, "\n").replace(/\n[ \t\f\v]+/g, "\n").replace(/[ \t\f\v]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
__name(cleanXText, "cleanXText");
function numericValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
__name(numericValue, "numericValue");
function buildDetails(input, preview, media, downloadedFiles = []) {
  return {
    source: preview,
    media,
    downloadedFiles,
    channels: input.channels,
    selectedMediaKeys: input.selectedMediaKeys,
    rightsConfirmed: input.rightsConfirmed
  };
}
__name(buildDetails, "buildDetails");
function defaultCaption(preview) {
  return preview.caption || preview.title || preview.description || preview.sourceUrl;
}
__name(defaultCaption, "defaultCaption");
function htmlToText(html2) {
  return decodeHtml(
    html2.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/[ \t\f\v]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n")
  ) || "";
}
__name(htmlToText, "htmlToText");
function extractXCaption(html2) {
  const paragraph = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(html2)?.[1] || html2;
  const text = htmlToText(paragraph).replace(/(?:https?:\/\/t\.co\/\S+|pic\.twitter\.com\/\S+)/gi, "").replace(/[ \t\f\v]+\n/g, "\n").replace(/\n[ \t\f\v]+/g, "\n").replace(/[ \t\f\v]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return text || null;
}
__name(extractXCaption, "extractXCaption");
function filenamePrefixFor(date) {
  const compact = date.toISOString().replace(/\D/g, "").slice(0, 14);
  return `cureation-${compact.slice(0, 8)}-${compact.slice(8)}`;
}
__name(filenamePrefixFor, "filenamePrefixFor");
function mediaTypeFor(downloaded, preview) {
  const first = downloaded.find((entry) => entry.ok);
  if (first?.mediaType) return first.mediaType;
  const candidate = preview.mediaCandidates.find((entry) => entry.mediaType !== "unknown");
  return candidate?.mediaType ?? null;
}
__name(mediaTypeFor, "mediaTypeFor");
function mediaKind(contentType) {
  return contentType.toLowerCase().startsWith("video/") ? "video" : "image";
}
__name(mediaKind, "mediaKind");
function extensionFor(contentType, sourceUrl) {
  const byType = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/quicktime": "mov"
  };
  const normalized = contentType.toLowerCase().split(";")[0].trim();
  if (byType[normalized]) return byType[normalized];
  const pathExt = /\.([a-z0-9]{2,5})(?:$|[?#])/i.exec(new URL(sourceUrl).pathname)?.[1];
  return pathExt || (normalized.startsWith("video/") ? "mp4" : "jpg");
}
__name(extensionFor, "extensionFor");
function stringValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
__name(stringValue, "stringValue");
function errorMessageText(error) {
  return error instanceof Error ? error.message : String(error);
}
__name(errorMessageText, "errorMessageText");
function og(html2, property) {
  return meta(html2, "property", property);
}
__name(og, "og");
function metaName(html2, name) {
  return meta(html2, "name", name);
}
__name(metaName, "metaName");
function meta(html2, attr, value) {
  const pattern = new RegExp(
    `<meta[^>]+${attr}=["']${escapeRegExp(value)}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const reversePattern = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${escapeRegExp(value)}["'][^>]*>`,
    "i"
  );
  return decodeHtml(pattern.exec(html2)?.[1] || reversePattern.exec(html2)?.[1] || "");
}
__name(meta, "meta");
function titleTag(html2) {
  return decodeHtml(/<title[^>]*>([^<]+)<\/title>/i.exec(html2)?.[1] || "");
}
__name(titleTag, "titleTag");
function decodeHtml(value) {
  if (!value) return null;
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&mdash;/g, "-").replace(/&ndash;/g, "-").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16))).trim() || null;
}
__name(decodeHtml, "decodeHtml");
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
__name(escapeRegExp, "escapeRegExp");
function stringInput(value) {
  return typeof value === "string" ? value : "";
}
__name(stringInput, "stringInput");
function arrayInput(value) {
  return Array.isArray(value) ? value : [];
}
__name(arrayInput, "arrayInput");
function isRecord2(value) {
  return typeof value === "object" && value !== null;
}
__name(isRecord2, "isRecord");
function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
__name(parseJson, "parseJson");

// src/lib/socialDraftPage.ts
function socialDraftPage() {
  return new Response(html(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
__name(socialDraftPage, "socialDraftPage");
function socialDraftManifest() {
  return new Response(
    JSON.stringify({
      name: "Cureation Social Draft",
      short_name: "Social Draft",
      start_url: "/tools/social-draft",
      scope: "/tools/social-draft",
      display: "standalone",
      background_color: "#f4f5f7",
      theme_color: "#b42318",
      icons: [
        {
          src: "/tools/social-draft/icon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any maskable"
        }
      ],
      share_target: {
        action: "/tools/social-draft",
        method: "GET",
        enctype: "application/x-www-form-urlencoded",
        params: {
          title: "title",
          text: "text",
          url: "url"
        }
      }
    }),
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "public, max-age=3600"
      }
    }
  );
}
__name(socialDraftManifest, "socialDraftManifest");
function socialDraftServiceWorker() {
  return new Response(
    `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));`,
    {
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}
__name(socialDraftServiceWorker, "socialDraftServiceWorker");
function socialDraftIcon() {
  return new Response(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#b42318"/>
  <path fill="#fff" d="M128 160c0-22.1 17.9-40 40-40h176c22.1 0 40 17.9 40 40v192c0 22.1-17.9 40-40 40H168c-22.1 0-40-17.9-40-40V160Zm56 40v32h144v-32H184Zm0 72v32h144v-32H184Z"/>
</svg>`,
    {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=86400"
      }
    }
  );
}
__name(socialDraftIcon, "socialDraftIcon");
function html() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#b42318">
  <link rel="manifest" href="/tools/social-draft/manifest.webmanifest">
  <title>Cureation Social Downloader</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f4f5f7;
      --panel: #ffffff;
      --ink: #101828;
      --muted: #667085;
      --rule: #d0d5dd;
      --accent: #b42318;
      --ok: #1f7a45;
      --bad: #a33024;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #111827;
        --panel: #1f2937;
        --ink: #f9fafb;
        --muted: #c7d0df;
        --rule: #374151;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-size: 15px;
      line-height: 1.45;
    }
    main {
      width: min(760px, calc(100vw - 20px));
      margin: 16px auto 28px;
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;
      align-items: start;
    }
    h1 {
      margin: 0 0 14px;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0;
    }
    form, aside {
      background: var(--panel);
      border: 1px solid var(--rule);
      border-radius: 8px;
      padding: 16px;
    }
    label {
      display: grid;
      gap: 7px;
      margin-bottom: 14px;
      font-weight: 650;
    }
    input, textarea {
      width: 100%;
      border: 1px solid var(--rule);
      background: color-mix(in srgb, var(--panel) 94%, var(--bg));
      color: var(--ink);
      padding: 11px 12px;
      font: inherit;
      font-size: 16px;
      border-radius: 4px;
    }
    input { min-height: 46px; }
    textarea { min-height: 118px; resize: vertical; }
    .hint {
      color: var(--muted);
      font-size: 13px;
      font-weight: 400;
    }
    .checks {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin: 0 0 16px;
    }
    .checks label {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      margin: 0;
      font-weight: 600;
      min-height: 36px;
    }
    .checks input { width: auto; }
    .media-preview {
      display: none;
      margin: 0 0 16px;
      border: 1px solid var(--rule);
      border-radius: 8px;
      overflow: hidden;
      background: color-mix(in srgb, var(--panel) 92%, var(--bg));
    }
    .media-preview.visible { display: block; }
    .media-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1px;
      background: var(--rule);
    }
    .media-item {
      min-height: 180px;
      background: #000;
      display: grid;
      align-items: center;
      justify-items: center;
      position: relative;
      overflow: hidden;
    }
    .media-item img,
    .media-item video {
      width: 100%;
      height: 100%;
      max-height: 440px;
      object-fit: contain;
      display: block;
      background: #000;
    }
    .media-remove {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 2;
      min-height: 34px;
      width: auto;
      padding: 6px 10px;
      border-color: rgba(255,255,255,.7);
      background: rgba(16,24,40,.78);
      color: #fff;
      font-size: 13px;
      line-height: 1;
    }
    .media-empty {
      padding: 14px;
      color: var(--muted);
      font-size: 14px;
    }
    .media-meta {
      padding: 10px 12px;
      color: var(--muted);
      font-size: 13px;
      border-top: 1px solid var(--rule);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .media-restore {
      min-height: 34px;
      width: auto;
      padding: 6px 10px;
      font-size: 13px;
      border-color: var(--rule);
      background: transparent;
      color: var(--ink);
    }
    button {
      border: 1px solid var(--accent);
      background: var(--accent);
      color: white;
      min-height: 46px;
      padding: 10px 14px;
      font: inherit;
      font-weight: 700;
      border-radius: 4px;
      cursor: pointer;
    }
    button.secondary {
      background: transparent;
      color: var(--ink);
      border-color: var(--rule);
    }
    button:disabled {
      cursor: wait;
      opacity: .65;
    }
    .actions {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      align-items: center;
    }
    .status {
      min-height: 24px;
      margin-top: 16px;
      color: var(--muted);
      white-space: pre-wrap;
    }
    .status.ok { color: var(--ok); }
    .status.bad { color: var(--bad); }
    pre {
      overflow: auto;
      max-height: 560px;
      margin: 0;
      padding: 14px;
      background: rgba(0,0,0,.05);
      border: 1px solid var(--rule);
      border-radius: 4px;
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    @media (max-width: 540px) {
      main { width: min(100% - 14px, 760px); margin-top: 8px; }
      form, aside { padding: 13px; border-radius: 6px; }
      .actions { grid-template-columns: 1fr; }
      button { width: 100%; }
      textarea { min-height: 108px; }
      .media-item { min-height: 220px; }
      pre { max-height: 420px; font-size: 11px; }
    }
  </style>
</head>
<body>
  <main>
    <section>
      <h1>Social Downloader</h1>
      <form data-form>
        <label>
          Manual token
          <input name="token" type="password" autocomplete="current-password" required>
          <span class="hint">Saved on this device after you enter it.</span>
        </label>
        <label>
          Source post URL
          <input name="sourceUrl" type="url" placeholder="https://x.com/..." required>
          <span class="hint">Pasting a supported link fills the caption from the embed preview.</span>
        </label>
        <div class="media-preview" data-media-preview aria-live="polite"></div>
        <label>
          Draft caption
          <textarea name="caption" placeholder="Caption will auto-fill here"></textarea>
        </label>
        <div class="checks">
          <label><input type="checkbox" name="channels" value="x" checked> X</label>
          <label><input type="checkbox" name="channels" value="instagram" checked> Instagram</label>
          <label><input type="checkbox" name="channels" value="bluesky" checked> Bluesky</label>
        </div>
        <div class="checks">
          <label><input type="checkbox" name="rightsConfirmed" required> I own or have permission to reuse this media</label>
        </div>
        <label>
          Draft ID
          <input name="draftId" type="text" placeholder="Created after saving" readonly>
        </label>
        <div class="actions">
          <button class="secondary" type="button" data-preview>Preview</button>
          <button type="submit">Save Draft</button>
          <button type="button" data-publish>Publish</button>
        </div>
        <div class="status" data-status></div>
      </form>
    </section>
    <aside>
      <pre data-output>{}</pre>
    </aside>
  </main>
  <script>
    const form = document.querySelector('[data-form]');
    const status = document.querySelector('[data-status]');
    const output = document.querySelector('[data-output]');
    const previewButton = document.querySelector('[data-preview]');
    const publishButton = document.querySelector('[data-publish]');
    const tokenInput = form.elements.token;
    const sourceInput = form.elements.sourceUrl;
    const captionInput = form.elements.caption;
    const draftIdInput = form.elements.draftId;
    const mediaPreview = document.querySelector('[data-media-preview]');
    const tokenKey = 'cureation.socialDraft.manualToken';
    let autoCaption = '';
    let captionTouched = false;
    let previewTimer = 0;
    let publishPollTimer = 0;
    let mediaItems = [];
    let selectedMediaKeys = null;

    tokenInput.value = localStorage.getItem(tokenKey) || '';
    hydrateSharedLink();
    registerServiceWorker();
    if (sourceInput.value && tokenInput.value) {
      schedulePreview(250);
    }

    function payload() {
      const data = new FormData(form);
      const body = {
        sourceUrl: String(data.get('sourceUrl') || '').trim(),
        caption: String(data.get('caption') || '').trim(),
        mediaUrls: [],
        channels: data.getAll('channels'),
        rightsConfirmed: data.get('rightsConfirmed') === 'on'
      };
      if (selectedMediaKeys !== null) {
        body.selectedMediaKeys = Array.from(selectedMediaKeys);
      }
      return body;
    }

    function publishPayload() {
      const data = new FormData(form);
      return {
        draftId: String(data.get('draftId') || '').trim(),
        channels: data.getAll('channels')
      };
    }

    async function submitJson(path, body) {
      const token = String(tokenInput.value || '').trim();
      if (!token) {
        throw new Error('Enter the manual token first.');
      }
      localStorage.setItem(tokenKey, token);
      const response = await fetch(path, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const text = await response.text();
      let json;
      try { json = JSON.parse(text); } catch { json = { raw: text }; }
      showJson(json);
      if (!response.ok || json.ok === false) {
        throw new Error(json.error || 'Request failed');
      }
      return json;
    }

    async function previewSource(manual) {
      if (!sourceInput.value.trim()) return null;
      if (!sourceInput.checkValidity()) {
        if (manual) sourceInput.reportValidity();
        return null;
      }
      setStatus(manual ? 'Previewing...' : 'Reading link...', '');
      const json = await submitJson('/run/social/drafts/preview', payload());
      fillCaptionFrom(json);
      renderMediaPreview(json);
      setStatus('Preview ready', 'ok');
      return json;
    }

    async function createDraft() {
      if (!form.reportValidity()) return null;
      setStatus('Saving draft...', '');
      const json = await submitJson('/run/social/drafts/create', payload());
      const draftId = json?.result?.details?.draftId;
      if (draftId) {
        draftIdInput.value = String(draftId);
      }
      fillCaptionFrom(json);
      renderMediaPreview(json);
      setStatus('Draft saved', 'ok');
      return draftId ? String(draftId) : null;
    }

    async function publishDraft() {
      if (!form.reportValidity()) return;
      clearPublishPolling();
      publishButton.disabled = true;
      let draftId = draftIdInput.value.trim();
      try {
        if (!draftId) {
          draftId = await createDraft();
        }
        if (!draftId) {
          publishButton.disabled = false;
          return;
        }
        setStatus('Starting publish...', '');
        const json = await submitJson('/run/social/drafts/publish', publishPayload());
        setStatus('Publishing started. Video can take a few minutes.', '');
        pollPublishStatus(draftId, 0);
        return json;
      } catch (error) {
        publishButton.disabled = false;
        throw error;
      }
    }

    function pollPublishStatus(draftId, attempt) {
      clearPublishPolling();
      const delay = attempt === 0 ? 2500 : 5000;
      publishPollTimer = setTimeout(async () => {
        try {
          const json = await submitJson('/run/social/drafts/status', { draftId });
          const details = json?.result?.details || {};
          const draftStatus = String(details.status || '').toLowerCase();
          const errorMessage = String(details.errorMessage || '').trim();
          if (draftStatus === 'published') {
            publishButton.disabled = false;
            setStatus('Publish complete', 'ok');
            return;
          }
          if (draftStatus === 'partial' || draftStatus === 'failed') {
            publishButton.disabled = false;
            setStatus((draftStatus === 'partial' ? 'Publish partially complete' : 'Publish failed') + (errorMessage ? '\\n' + errorMessage : ''), 'bad');
            return;
          }
          if (attempt >= 72) {
            publishButton.disabled = false;
            setStatus('Still publishing. Check the draft status again in Directus before retrying.', '');
            return;
          }
          setStatus('Publishing...' + (errorMessage ? '\\n' + errorMessage : ''), '');
          pollPublishStatus(draftId, attempt + 1);
        } catch (error) {
          if (attempt >= 5) {
            publishButton.disabled = false;
            setStatus(error.message, 'bad');
            return;
          }
          pollPublishStatus(draftId, attempt + 1);
        }
      }, delay);
    }

    function clearPublishPolling() {
      clearTimeout(publishPollTimer);
      publishPollTimer = 0;
    }

    function fillCaptionFrom(json) {
      const source = json?.result?.details?.source || {};
      const caption = String(source.caption || source.title || source.description || '').trim();
      if (!caption) return;
      if (!captionTouched || !captionInput.value.trim() || captionInput.value === autoCaption) {
        autoCaption = caption;
        captionInput.value = caption;
        captionTouched = false;
      }
    }

    function showJson(json) {
      output.textContent = JSON.stringify(json, null, 2);
    }

    function renderMediaPreview(json) {
      const candidates = Array.isArray(json?.result?.details?.source?.mediaCandidates)
        ? json.result.details.source.mediaCandidates
        : [];
      mediaItems = candidates
        .filter((entry) => entry && entry.url)
        .map((entry, index) => ({
          url: String(entry.url),
          mediaType: String(entry.mediaType || ''),
          source: String(entry.source || ''),
          selectionKey: String(entry.selectionKey || mediaFallbackKey(entry, index))
        }));
      if (selectedMediaKeys === null) {
        selectedMediaKeys = new Set(mediaItems.map((entry) => entry.selectionKey));
      } else {
        const available = new Set(mediaItems.map((entry) => entry.selectionKey));
        selectedMediaKeys = new Set(Array.from(selectedMediaKeys).filter((key) => available.has(key)));
      }
      renderMediaPreviewState();
    }

    function renderMediaPreviewState() {
      mediaPreview.classList.add('visible');
      if (mediaItems.length === 0) {
        mediaPreview.innerHTML = '<div class="media-empty">No image or video found for this link.</div>';
        return;
      }

      const selected = mediaItems.filter((entry) => selectedMediaKeys?.has(entry.selectionKey));
      const removedCount = mediaItems.length - selected.length;
      if (selected.length === 0) {
        mediaPreview.innerHTML =
          '<div class="media-empty">No media selected for this draft.</div>' +
          mediaMetaHtml(0, removedCount);
        return;
      }

      const items = selected.slice(0, 8).map((entry) => {
        const url = escapeHtml(entry.url);
        const key = escapeHtml(entry.selectionKey);
        const type = entry.mediaType;
        const removeButton = '<button type="button" class="media-remove" data-remove-media="' + key + '">Delete</button>';
        if (type === 'video') {
          return '<div class="media-item">' + removeButton + '<video src="' + url + '" controls playsinline preload="metadata"></video></div>';
        }
        if (type === 'image') {
          return '<div class="media-item">' + removeButton + '<img src="' + url + '" alt=""></div>';
        }
        return '<div class="media-item">' + removeButton + '<a href="' + url + '" target="_blank" rel="noreferrer">Open media</a></div>';
      }).join('');

      mediaPreview.innerHTML =
        '<div class="media-grid">' + items + '</div>' +
        mediaMetaHtml(selected.length, removedCount);
    }

    function mediaMetaHtml(selectedCount, removedCount) {
      const label = selectedCount + ' media item' + (selectedCount === 1 ? '' : 's') + ' selected' +
        (removedCount > 0 ? ' \xB7 ' + removedCount + ' removed' : '');
      const restore = removedCount > 0
        ? '<button type="button" class="media-restore" data-restore-media>Restore all</button>'
        : '';
      return '<div class="media-meta"><span>' + label + '</span>' + restore + '</div>';
    }

    function mediaFallbackKey(entry, index) {
      return String(entry.mediaType || 'unknown') + ':' + String(entry.source || 'source') + ':' + index;
    }

    function resetMediaSelection() {
      mediaItems = [];
      selectedMediaKeys = null;
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    function setStatus(message, state) {
      status.className = 'status' + (state ? ' ' + state : '');
      status.textContent = message;
    }

    function schedulePreview(delay) {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => {
        if (!tokenInput.value.trim()) {
          setStatus('Enter the manual token to preview.', '');
          return;
        }
        previewSource(false).catch((error) => setStatus(error.message, 'bad'));
      }, delay);
    }

    function hydrateSharedLink() {
      const params = new URLSearchParams(location.search);
      const shared = params.get('url') || params.get('text') || params.get('title') || '';
      const link = firstHttpUrl(shared);
      if (link && !sourceInput.value) {
        sourceInput.value = link;
      }
    }

    function firstHttpUrl(value) {
      const match = String(value || '').match(/https?:\\/\\/[^\\s]+/i);
      return match ? match[0] : '';
    }

    function registerServiceWorker() {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/tools/social-draft/sw.js', { scope: '/tools/social-draft' }).catch(() => {});
      }
    }

    tokenInput.addEventListener('input', () => {
      localStorage.setItem(tokenKey, String(tokenInput.value || '').trim());
      if (sourceInput.value.trim()) schedulePreview(350);
    });
    sourceInput.addEventListener('input', () => {
      draftIdInput.value = '';
      clearPublishPolling();
      publishButton.disabled = false;
      resetMediaSelection();
      mediaPreview.classList.remove('visible');
      mediaPreview.innerHTML = '';
      schedulePreview(650);
    });
    sourceInput.addEventListener('paste', () => {
      draftIdInput.value = '';
      clearPublishPolling();
      publishButton.disabled = false;
      resetMediaSelection();
      setTimeout(() => schedulePreview(150), 0);
    });
    mediaPreview.addEventListener('click', (event) => {
      const target = event.target;
      if (!target || !target.closest) return;
      const removeButton = target.closest('[data-remove-media]');
      if (removeButton) {
        const key = removeButton.getAttribute('data-remove-media');
        if (key && selectedMediaKeys) {
          selectedMediaKeys.delete(key);
          draftIdInput.value = '';
          renderMediaPreviewState();
        }
        return;
      }
      if (target.closest('[data-restore-media]')) {
        selectedMediaKeys = new Set(mediaItems.map((entry) => entry.selectionKey));
        draftIdInput.value = '';
        renderMediaPreviewState();
      }
    });
    captionInput.addEventListener('input', () => {
      captionTouched = captionInput.value !== autoCaption;
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      createDraft().catch((error) => setStatus(error.message, 'bad'));
    });
    previewButton.addEventListener('click', () => {
      previewSource(true).catch((error) => setStatus(error.message, 'bad'));
    });
    publishButton.addEventListener('click', () => {
      publishDraft().catch((error) => setStatus(error.message, 'bad'));
    });
  <\/script>
</body>
</html>`;
}
__name(html, "html");

// src/jobs/enrichSetlists.ts
var DEFAULT_LIMIT = 25;
var NOTE_MUSICIAN_PATTERN = /(?:^|[\n.;]\s*)([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){1,3})\s+playing\s+([^.;\n]+)/gi;
async function enrichSetlists(env, options = {}) {
  const directus = new DirectusClient(env);
  const run = await startAutomationRun(directus, SETLIST_ENRICHMENT_JOB_NAME);
  try {
    const setlistFields2 = await directus.fieldSet("setlists");
    const memberFields = await directus.fieldSet("members");
    if (!setlistFields2.has("performing_musicians")) {
      throw new Error("setlists.performing_musicians is missing");
    }
    const rows = await directus.list("setlists", {
      filter: enrichmentFilter(setlistFields2, options.force === true),
      fields: [
        "id",
        "slug",
        "venue",
        "date",
        "notes",
        "performing_musicians",
        "setlistfm_url",
        "source"
      ].filter((field) => setlistFields2.has(field)),
      sort: "-date",
      limit: clampLimit(options.limit)
    });
    let setlistsUpdated = 0;
    let setlistsSkipped = 0;
    let memberMatches = 0;
    let memberSourceUpdates = 0;
    const examples = [];
    for (const setlist of rows) {
      const parsed = parsePerformingMusicians(setlist);
      if (parsed.length === 0) {
        setlistsSkipped += 1;
        continue;
      }
      for (const musician of parsed) {
        const member = await findMemberByName(directus, musician.name);
        if (!member) {
          continue;
        }
        musician.member = member.id;
        musician.member_slug = member.slug ?? null;
        memberMatches += 1;
        if (options.updateMemberSources === true && memberFields.has("source_url")) {
          const updated = await appendMemberSource(directus, member, musician.source_url);
          if (updated) {
            memberSourceUpdates += 1;
          }
        }
      }
      const existing = normalizeMusicianList(setlist.performing_musicians);
      const merged = mergeMusicianLists(existing, parsed);
      if (merged.length === existing.length) {
        setlistsSkipped += 1;
        continue;
      }
      await directus.update("setlists", setlist.id, {
        performing_musicians: merged,
        ...optionalFields(setlistFields2, {
          last_enriched_at: (/* @__PURE__ */ new Date()).toISOString()
        })
      });
      setlistsUpdated += 1;
      examples.push({
        id: setlist.id,
        slug: setlist.slug ?? null,
        names: parsed.map((musician) => musician.name)
      });
    }
    const result = {
      jobName: SETLIST_ENRICHMENT_JOB_NAME,
      itemsCreated: 0,
      itemsUpdated: setlistsUpdated,
      itemsSkipped: setlistsSkipped,
      details: {
        inspected: rows.length,
        memberMatches,
        memberSourceUpdates,
        examples: examples.slice(0, 5)
      }
    };
    await completeAutomationRun(directus, run.id, result);
    return result;
  } catch (error) {
    await failAutomationRun(directus, run.id, error);
    throw error;
  }
}
__name(enrichSetlists, "enrichSetlists");
function enrichmentFilter(setlistFields2, force) {
  const filter = {
    notes: { _nnull: true }
  };
  if (!force) {
    if (setlistFields2.has("last_enriched_at")) {
      filter.last_enriched_at = { _null: true };
    }
    if (setlistFields2.has("performing_musicians")) {
      filter.performing_musicians = { _null: true };
    }
  }
  return filter;
}
__name(enrichmentFilter, "enrichmentFilter");
function parsePerformingMusicians(setlist) {
  if (!setlist.notes) {
    return [];
  }
  const sourceUrl = setlist.setlistfm_url || firstUrl(setlist.source);
  const parsed = [];
  NOTE_MUSICIAN_PATTERN.lastIndex = 0;
  for (const match of setlist.notes.matchAll(NOTE_MUSICIAN_PATTERN)) {
    const name = match[1]?.trim();
    const instrumentText = match[2]?.trim();
    if (!name || !instrumentText) {
      continue;
    }
    const instruments = normalizeInstruments(instrumentText);
    if (instruments.length === 0) {
      continue;
    }
    parsed.push({
      name,
      role: "guest musician",
      instruments,
      source: "setlist.fm notes",
      source_url: sourceUrl,
      extracted_from: match[0].trim(),
      confidence: "high"
    });
  }
  return parsed;
}
__name(parsePerformingMusicians, "parsePerformingMusicians");
function normalizeInstruments(value) {
  return unique(
    value.replace(/\band\b/gi, ",").split(/[,/+]/).map((entry) => entry.trim().toLowerCase()).filter(Boolean)
  );
}
__name(normalizeInstruments, "normalizeInstruments");
function normalizeMusicianList(value) {
  const parsed = typeof value === "string" ? parseJson2(value) : value;
  if (Array.isArray(parsed)) {
    return parsed.filter(isRecord3).map((entry) => entry);
  }
  if (isRecord3(parsed)) {
    return [parsed];
  }
  return [];
}
__name(normalizeMusicianList, "normalizeMusicianList");
function mergeMusicianLists(existing, additions) {
  const keys = new Set(existing.map(musicianKey));
  const merged = [...existing];
  for (const addition of additions) {
    const key = musicianKey(addition);
    if (keys.has(key)) {
      continue;
    }
    keys.add(key);
    merged.push(addition);
  }
  return merged;
}
__name(mergeMusicianLists, "mergeMusicianLists");
function musicianKey(musician) {
  const instruments = Array.isArray(musician.instruments) ? musician.instruments.map((instrument) => String(instrument)).join(",") : "";
  return [
    String(musician.name || "").toLowerCase(),
    String(musician.role || "").toLowerCase(),
    instruments,
    musician.source_url || "",
    String(musician.extracted_from || "").toLowerCase()
  ].join("|");
}
__name(musicianKey, "musicianKey");
async function findMemberByName(directus, name) {
  return directus.first(
    "members",
    { name: { _eq: name } },
    ["id", "name", "slug", "source_url"]
  );
}
__name(findMemberByName, "findMemberByName");
async function appendMemberSource(directus, member, sourceUrl) {
  if (!sourceUrl) {
    return false;
  }
  const existing = member.source_url || "";
  const lines = existing.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.includes(sourceUrl)) {
    return false;
  }
  await directus.update("members", member.id, {
    source_url: [...lines, sourceUrl].join("\n")
  });
  return true;
}
__name(appendMemberSource, "appendMemberSource");
function firstUrl(value) {
  return value?.split(/\n+/).map((entry) => entry.trim()).find((entry) => /^https?:\/\//i.test(entry)) ?? null;
}
__name(firstUrl, "firstUrl");
function clampLimit(value) {
  if (value === void 0 || !Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(100, Math.max(1, Math.floor(value)));
}
__name(clampLimit, "clampLimit");
function unique(values) {
  return [...new Set(values)];
}
__name(unique, "unique");
function parseJson2(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
__name(parseJson2, "parseJson");
function isRecord3(value) {
  return typeof value === "object" && value !== null;
}
__name(isRecord3, "isRecord");

// src/lib/lyrics.ts
async function getLyricOfDay(directus, now = /* @__PURE__ */ new Date()) {
  const songs = await directus.list("songs", {
    filter: { lyrics: { _nnull: true } },
    fields: ["id", "title", "slug", "album.id", "album.title", "track_number", "lyrics", "lyrics_structured"],
    limit: -1
  });
  if (songs.length === 0) {
    return null;
  }
  const index = dayIndex(now);
  const song = songs[index % songs.length];
  const sections = normalizeLyricSections(song.lyrics_structured, song.lyrics);
  const lines = selectLyricPassage(sections, index, 3);
  if (lines.length === 0) {
    return null;
  }
  return {
    lines,
    dayIndex: index,
    song: {
      id: song.id,
      title: song.title || "Untitled",
      slug: song.slug || null,
      albumId: relationId(song.album),
      albumTitle: isRecord3(song.album) && typeof song.album.title === "string" ? song.album.title : null,
      trackNumber: Number.isInteger(Number(song.track_number)) ? Number(song.track_number) : null
    }
  };
}
__name(getLyricOfDay, "getLyricOfDay");
function dayIndex(now = /* @__PURE__ */ new Date()) {
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - start;
  return Math.floor(diff / 864e5);
}
__name(dayIndex, "dayIndex");

// src/jobs/postLyricOfDay.ts
async function postLyricOfDay(env, options = {}) {
  const directus = new DirectusClient(env);
  const run = await startAutomationRun(directus, SOCIAL_LYRIC_JOB_NAME);
  try {
    const lyric = await getLyricOfDay(directus);
    if (!lyric) {
      throw new Error("No lyric of the day is available from Directus songs");
    }
    const text = buildLyricPostText({
      lines: lyric.lines,
      title: lyric.song.title,
      trackNumber: lyric.song.trackNumber,
      albumTitle: lyric.song.albumTitle
    });
    const publish = options.publish === true;
    const channels = await publishToSocialChannels(env, text, publish, options.channels);
    const publishedCount = channels.filter((channel) => channel.published).length;
    const skippedCount = channels.length - publishedCount;
    const result = {
      jobName: SOCIAL_LYRIC_JOB_NAME,
      itemsCreated: publishedCount,
      itemsUpdated: 0,
      itemsSkipped: skippedCount,
      details: {
        publish,
        requestedChannels: options.channels ?? ["x", "bluesky"],
        template: "website_lyric_of_the_day",
        text,
        lyric: {
          dayIndex: lyric.dayIndex,
          songId: lyric.song.id,
          songTitle: lyric.song.title,
          songSlug: lyric.song.slug,
          albumId: lyric.song.albumId,
          albumTitle: lyric.song.albumTitle,
          trackNumber: lyric.song.trackNumber,
          lines: lyric.lines
        },
        channels
      }
    };
    await completeAutomationRun(directus, run.id, result);
    return result;
  } catch (error) {
    await failAutomationRun(directus, run.id, error);
    throw error;
  }
}
__name(postLyricOfDay, "postLyricOfDay");

// src/lib/socialLog.ts
async function successfulChannels(directus, contentKey) {
  const rows = await directus.list("social_post_log", {
    filter: {
      content_key: { _eq: contentKey },
      status: { _eq: "success" }
    },
    fields: ["channel"],
    limit: -1
  });
  return new Set(
    rows.map((row) => row.channel).filter((channel) => channel === "x" || channel === "bluesky")
  );
}
__name(successfulChannels, "successfulChannels");
async function recordSocialResults(directus, input) {
  for (const result of input.results) {
    await directus.create("social_post_log", {
      job_name: input.jobName,
      content_type: input.contentType,
      content_key: input.contentKey,
      content_id: String(input.contentId),
      channel: result.channel,
      status: result.error ? result.published ? "partial" : "failed" : "success",
      posted_at: (/* @__PURE__ */ new Date()).toISOString(),
      external_id: result.id ?? null,
      external_uri: result.uri ?? null,
      post_text: input.postText,
      error_message: result.error ?? null
    });
  }
}
__name(recordSocialResults, "recordSocialResults");
function missingChannels(requestedChannels, postedChannels) {
  return requestedChannels.filter((channel) => !postedChannels.has(channel));
}
__name(missingChannels, "missingChannels");

// src/jobs/postSetlists.ts
var DEFAULT_CHANNELS = ["x", "bluesky"];
var MAX_POST_LENGTH = 280;
var RECENT_EVENT_DAYS = 14;
async function postOnThisDaySetlist(env, options = {}) {
  const directus = new DirectusClient(env);
  const run = await startAutomationRun(directus, SOCIAL_ON_THIS_DAY_SETLIST_JOB_NAME);
  try {
    const now = options.now ?? /* @__PURE__ */ new Date();
    const today = isoDate(now);
    const candidates = await onThisDayCandidates(directus, today);
    if (candidates.length === 0) {
      const result2 = emptyResult(SOCIAL_ON_THIS_DAY_SETLIST_JOB_NAME, "No setlists found for this day");
      await completeAutomationRun(directus, run.id, result2);
      return result2;
    }
    const setlist = candidates[now.getUTCFullYear() % candidates.length];
    const songs = await getSetlistSongs(directus, setlist.id);
    const contentKey = `on-this-day-setlist:${today}`;
    const channels = await channelsToPublish(directus, contentKey, options);
    const text = buildOnThisDayPost(setlist, songs);
    const results = await publishToSocialChannels(env, text, options.publish === true, channels);
    if (options.publish === true && results.length > 0) {
      await recordSocialResults(directus, {
        jobName: SOCIAL_ON_THIS_DAY_SETLIST_JOB_NAME,
        contentType: "setlist",
        contentKey,
        contentId: setlist.id,
        postText: text,
        results
      });
    }
    const result = {
      jobName: SOCIAL_ON_THIS_DAY_SETLIST_JOB_NAME,
      itemsCreated: results.filter((entry) => entry.published).length,
      itemsUpdated: 0,
      itemsSkipped: DEFAULT_CHANNELS.length - results.filter((entry) => entry.published).length,
      details: {
        publish: options.publish === true,
        contentKey,
        setlist: summary(setlist),
        requestedChannels: options.channels ?? DEFAULT_CHANNELS,
        channels,
        text,
        results
      }
    };
    await completeAutomationRun(directus, run.id, result);
    return result;
  } catch (error) {
    await failAutomationRun(directus, run.id, error);
    throw error;
  }
}
__name(postOnThisDaySetlist, "postOnThisDaySetlist");
async function postRecentEventSetlist(env, options = {}) {
  const directus = new DirectusClient(env);
  const run = await startAutomationRun(directus, SOCIAL_POST_EVENT_SETLIST_JOB_NAME);
  try {
    const now = options.now ?? /* @__PURE__ */ new Date();
    const candidate = await nextRecentEventCandidate(directus, now, options);
    if (!candidate) {
      const result2 = emptyResult(SOCIAL_POST_EVENT_SETLIST_JOB_NAME, "No recent completed setlists need posting");
      await completeAutomationRun(directus, run.id, result2);
      return result2;
    }
    const songs = await getSetlistSongs(directus, candidate.setlist.id);
    const thread = buildFullSetlistThread(candidate.setlist, songs);
    const results = await publishThreadToSocialChannels(
      env,
      thread,
      options.publish === true,
      candidate.channels
    );
    if (options.publish === true && results.length > 0) {
      await recordSocialResults(directus, {
        jobName: SOCIAL_POST_EVENT_SETLIST_JOB_NAME,
        contentType: "setlist",
        contentKey: candidate.contentKey,
        contentId: candidate.setlist.id,
        postText: thread.join("\n\n---\n\n"),
        results
      });
    }
    const result = {
      jobName: SOCIAL_POST_EVENT_SETLIST_JOB_NAME,
      itemsCreated: results.filter((entry) => entry.published).length,
      itemsUpdated: 0,
      itemsSkipped: DEFAULT_CHANNELS.length - results.filter((entry) => entry.published).length,
      details: {
        publish: options.publish === true,
        contentKey: candidate.contentKey,
        setlist: summary(candidate.setlist),
        requestedChannels: options.channels ?? DEFAULT_CHANNELS,
        channels: candidate.channels,
        posts: thread,
        results
      }
    };
    await completeAutomationRun(directus, run.id, result);
    return result;
  } catch (error) {
    await failAutomationRun(directus, run.id, error);
    throw error;
  }
}
__name(postRecentEventSetlist, "postRecentEventSetlist");
async function onThisDayCandidates(directus, today) {
  const monthDay = today.slice(5);
  const rows = await directus.list("setlists", {
    filter: {
      date: { _nnull: true },
      song_count: { _gt: 0 }
    },
    fields: setlistFields(),
    sort: "date",
    limit: -1
  });
  return rows.filter((row) => row.date && row.date < today && row.date.slice(5) === monthDay);
}
__name(onThisDayCandidates, "onThisDayCandidates");
async function nextRecentEventCandidate(directus, now, options) {
  const today = isoDate(now);
  const from = isoDate(new Date(now.getTime() - RECENT_EVENT_DAYS * 24 * 60 * 60 * 1e3));
  const rows = await directus.list("setlists", {
    filter: {
      date: { _between: [from, today] },
      song_count: { _gt: 0 }
    },
    fields: setlistFields(),
    sort: "date",
    limit: 20
  });
  for (const setlist of rows) {
    const contentKey = `post-event-setlist:${setlist.id}`;
    const channels = await channelsToPublish(directus, contentKey, options);
    if (channels.length > 0) {
      return { setlist, contentKey, channels };
    }
  }
  return null;
}
__name(nextRecentEventCandidate, "nextRecentEventCandidate");
async function channelsToPublish(directus, contentKey, options) {
  const requested = options.channels ?? DEFAULT_CHANNELS;
  if (options.force === true || options.publish !== true) {
    return requested;
  }
  return missingChannels(requested, await successfulChannels(directus, contentKey));
}
__name(channelsToPublish, "channelsToPublish");
async function getSetlistSongs(directus, setlistId) {
  return directus.list("setlist_songs", {
    filter: { setlist: { _eq: setlistId } },
    fields: [
      "id",
      "position",
      "set_type",
      "notes",
      "song_title",
      "is_cover",
      "cover_artist"
    ],
    sort: "position",
    limit: -1
  });
}
__name(getSetlistSongs, "getSetlistSongs");
function buildOnThisDayPost(setlist, songs) {
  const year = setlist.date?.slice(0, 4) ?? "the archive";
  const titles = songs.map((song) => songTitle(song)).filter(Boolean);
  for (let previewCount = Math.min(8, titles.length); previewCount >= 0; previewCount -= 1) {
    const preview = titles.slice(0, previewCount);
    const moreCount = Math.max(0, titles.length - preview.length);
    const text = [
      `On this day in ${year}: The Cure at ${showLocation(setlist)}.`,
      "",
      `${songs.length} songs documented${setlist.tour_name ? ` - ${setlist.tour_name}` : ""}.`,
      ...preview.map((title, index) => `${index + 1}. ${title}`),
      moreCount > 0 && previewCount > 0 ? `...and ${moreCount} more.` : null
    ].filter((line) => line !== null).join("\n");
    if (text.length <= MAX_POST_LENGTH) {
      return text;
    }
  }
  return fitText(
    [
      `On this day in ${year}: The Cure at ${showLocation(setlist)}.`,
      `${songs.length} songs documented.`
    ].join("\n"),
    MAX_POST_LENGTH
  );
}
__name(buildOnThisDayPost, "buildOnThisDayPost");
function buildFullSetlistThread(setlist, songs) {
  const lines = [
    `The Cure at ${showLocation(setlist)}`,
    [setlist.date, setlist.tour_name].filter(Boolean).join(" - "),
    "",
    "Full setlist:",
    ...songLines(songs)
  ].filter(Boolean);
  return packLines(lines, MAX_POST_LENGTH);
}
__name(buildFullSetlistThread, "buildFullSetlistThread");
function songLines(songs) {
  let currentSetType = "";
  const lines = [];
  for (const song of songs) {
    const setType = song.set_type || "";
    if (setType && setType !== currentSetType) {
      currentSetType = setType;
      lines.push("");
      lines.push(titleCase(setType));
    }
    const notes = song.notes ? ` (${song.notes})` : "";
    const cover = song.is_cover && song.cover_artist ? ` [${song.cover_artist}]` : "";
    lines.push(`${song.position ?? lines.length}. ${songTitle(song)}${cover}${notes}`);
  }
  return lines;
}
__name(songLines, "songLines");
function packLines(lines, maxLength) {
  const posts = [];
  let current = "";
  for (const line of lines) {
    const safeLine = fitLine(line, maxLength);
    const candidate = current ? `${current}
${safeLine}` : safeLine;
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }
    if (current) {
      posts.push(current);
    }
    current = safeLine;
  }
  if (current) {
    posts.push(current);
  }
  return posts;
}
__name(packLines, "packLines");
function fitText(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}
__name(fitText, "fitText");
function fitLine(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}
__name(fitLine, "fitLine");
function songTitle(song) {
  return song.song_title || "Untitled";
}
__name(songTitle, "songTitle");
function showLocation(setlist) {
  return [
    setlist.venue || "Unknown venue",
    setlist.city,
    setlist.country
  ].filter(Boolean).join(", ");
}
__name(showLocation, "showLocation");
function summary(setlist) {
  return {
    id: setlist.id,
    slug: setlist.slug ?? null,
    date: setlist.date ?? null,
    venue: setlist.venue ?? null,
    songCount: setlist.song_count ?? null
  };
}
__name(summary, "summary");
function emptyResult(jobName, reason) {
  return {
    jobName,
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsSkipped: 1,
    details: { reason }
  };
}
__name(emptyResult, "emptyResult");
function setlistFields() {
  return [
    "id",
    "slug",
    "date",
    "venue",
    "city",
    "country",
    "tour_name",
    "song_count",
    "notes"
  ];
}
__name(setlistFields, "setlistFields");
function titleCase(value) {
  return value.split(/[\s_-]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
__name(titleCase, "titleCase");
function isoDate(date) {
  return date.toISOString().slice(0, 10);
}
__name(isoDate, "isoDate");

// src/lib/dates.ts
function setlistFmCheckpoint(date) {
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hour = pad(date.getUTCHours());
  const minute = pad(date.getUTCMinutes());
  const second = pad(date.getUTCSeconds());
  return `${year}${month}${day}${hour}${minute}${second}`;
}
__name(setlistFmCheckpoint, "setlistFmCheckpoint");
function sevenDaysAgoCheckpoint(now = /* @__PURE__ */ new Date()) {
  return setlistFmCheckpoint(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3));
}
__name(sevenDaysAgoCheckpoint, "sevenDaysAgoCheckpoint");
function parseSetlistFmEventDate(eventDate) {
  const [day, month, year] = eventDate.split("-");
  if (!day || !month || !year) {
    throw new Error(`Invalid setlist.fm eventDate: ${eventDate}`);
  }
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}
__name(parseSetlistFmEventDate, "parseSetlistFmEventDate");
function normalizeSetlistFmUpdatedAt(value) {
  if (!value) {
    return void 0;
  }
  const compact = value.replace(/\D/g, "");
  if (compact.length >= 14 && /^\d+$/.test(compact)) {
    return compact.slice(0, 14);
  }
  const isoish = value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const parsed = new Date(isoish);
  return Number.isNaN(parsed.getTime()) ? void 0 : setlistFmCheckpoint(parsed);
}
__name(normalizeSetlistFmUpdatedAt, "normalizeSetlistFmUpdatedAt");
function directusTimestampFromSetlistFm(value) {
  if (!value) {
    return null;
  }
  const isoish = value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const parsed = new Date(isoish);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
__name(directusTimestampFromSetlistFm, "directusTimestampFromSetlistFm");
function pad(value) {
  return String(value).padStart(2, "0");
}
__name(pad, "pad");

// src/lib/hashing.ts
async function sha256Hex(value) {
  const serialized = stableStringify(value);
  const bytes = new TextEncoder().encode(serialized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(sha256Hex, "sha256Hex");
function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
__name(stableStringify, "stableStringify");

// src/lib/setlistfm.ts
var API_BASE = "https://api.setlist.fm/rest/1.0";
var THE_CURE_MBID = "69ee3720-a7cb-4402-b48d-a02c366f2bcf";
async function searchUpdatedSetlists(apiKey, lastUpdated) {
  const allSetlists = [];
  let page = 1;
  let totalPages = 1;
  do {
    const data = await fetchSetlistPage(apiKey, lastUpdated, page);
    const setlists = data.setlist ?? [];
    allSetlists.push(...setlists);
    const perPage = data.itemsPerPage || setlists.length || 20;
    totalPages = Math.max(1, Math.ceil((data.total ?? setlists.length) / perPage));
    page += 1;
  } while (page <= totalPages);
  return allSetlists;
}
__name(searchUpdatedSetlists, "searchUpdatedSetlists");
async function fetchSetlistPage(apiKey, lastUpdated, page) {
  const url = new URL(`${API_BASE}/search/setlists`);
  url.searchParams.set("artistMbid", THE_CURE_MBID);
  url.searchParams.set("lastUpdated", lastUpdated);
  url.searchParams.set("p", String(page));
  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "x-api-key": apiKey
    }
  });
  const responseText = await response.text();
  if (response.status === 404) {
    return {
      itemsPerPage: 20,
      page,
      total: 0,
      setlist: []
    };
  }
  if (!response.ok) {
    throw new Error(
      `setlist.fm request failed with ${response.status}: ${responseText.slice(0, 500)}`
    );
  }
  return JSON.parse(responseText);
}
__name(fetchSetlistPage, "fetchSetlistPage");

// src/lib/slugs.ts
function slugify(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180);
}
__name(slugify, "slugify");

// src/jobs/syncSetlists.ts
var CHECKPOINT_PROVIDER = "setlistfm";
var CHECKPOINT_KEY = "the-cure-setlists";
async function syncSetlists(env) {
  const directus = new DirectusClient(env);
  const checkpoint = await getCheckpoint(directus);
  const checkpointFrom = checkpoint?.last_seen_external_update || sevenDaysAgoCheckpoint();
  const run = await startAutomationRun(directus, SETLIST_JOB_NAME, checkpointFrom);
  try {
    const context = {
      directus,
      setlistFields: await directus.fieldSet("setlists"),
      songFields: await directus.fieldSet("songs"),
      sourceId: await getSetlistFmSourceId(directus)
    };
    const setlists = await searchUpdatedSetlists(env.SETLISTFM_API_KEY, checkpointFrom);
    let itemsCreated = 0;
    let itemsUpdated = 0;
    let itemsSkipped = 0;
    let maxExternalUpdate = checkpointFrom;
    for (const setlist of setlists) {
      const normalizedUpdate = normalizeSetlistFmUpdatedAt(setlist.lastUpdated);
      if (normalizedUpdate && normalizedUpdate > maxExternalUpdate) {
        maxExternalUpdate = normalizedUpdate;
      }
      const outcome = await processSetlist(context, setlist);
      if (outcome.created) {
        itemsCreated += 1;
      } else if (outcome.updated) {
        itemsUpdated += 1;
      } else if (outcome.skipped) {
        itemsSkipped += 1;
      }
    }
    const checkpointTo = maxCheckpoint(maxExternalUpdate, setlistFmCheckpoint(/* @__PURE__ */ new Date()));
    await saveCheckpoint(directus, checkpoint, checkpointTo);
    const result = {
      jobName: SETLIST_JOB_NAME,
      itemsCreated,
      itemsUpdated,
      itemsSkipped,
      checkpointFrom,
      checkpointTo
    };
    await completeAutomationRun(directus, run.id, result);
    return result;
  } catch (error) {
    await failAutomationRun(directus, run.id, error);
    throw error;
  }
}
__name(syncSetlists, "syncSetlists");
async function getCheckpoint(directus) {
  return directus.first("import_checkpoints", {
    provider: { _eq: CHECKPOINT_PROVIDER },
    checkpoint_key: { _eq: CHECKPOINT_KEY }
  });
}
__name(getCheckpoint, "getCheckpoint");
async function saveCheckpoint(directus, checkpoint, checkpointTo) {
  const data = {
    provider: CHECKPOINT_PROVIDER,
    checkpoint_key: CHECKPOINT_KEY,
    last_successful_at: (/* @__PURE__ */ new Date()).toISOString(),
    last_seen_external_update: checkpointTo
  };
  if (checkpoint) {
    await directus.update("import_checkpoints", checkpoint.id, data);
  } else {
    await directus.create("import_checkpoints", data);
  }
}
__name(saveCheckpoint, "saveCheckpoint");
async function getSetlistFmSourceId(directus) {
  const source = await directus.first("sources", {
    name: { _eq: "setlist.fm" }
  });
  return source?.id ?? null;
}
__name(getSetlistFmSourceId, "getSetlistFmSourceId");
async function processSetlist(context, setlist) {
  const sourceHash = await setlistHash(setlist);
  const existing = await findExistingSetlist(context, setlist);
  if (existing?.source_hash === sourceHash) {
    return { created: false, updated: false, skipped: true };
  }
  const existingTourId = relationId(existing?.tour);
  const setlistFmTourId = existingTourId ?? await upsertTour(context, setlist);
  const tourAssignment = chooseTourAssignment(
    existing,
    setlist.tour?.name,
    setlistFmTourId
  );
  const venueId = await upsertVenue(context, setlist);
  const date = parseSetlistFmEventDate(setlist.eventDate);
  const songCount = countSongs(setlist);
  const setlistData = buildSetlistData(
    context,
    setlist,
    existing,
    date,
    sourceHash,
    songCount,
    tourAssignment,
    venueId
  );
  let setlistId;
  if (existing) {
    const updated = await context.directus.update(
      "setlists",
      existing.id,
      setlistData
    );
    setlistId = updated.id;
    await replaceSetlistSongs(context, setlistId, setlist);
    return { created: false, updated: true, skipped: false };
  }
  const created = await context.directus.create("setlists", setlistData);
  setlistId = created.id;
  await replaceSetlistSongs(context, setlistId, setlist);
  return { created: true, updated: false, skipped: false };
}
__name(processSetlist, "processSetlist");
async function findExistingSetlist(context, setlist) {
  const fields = ["id"];
  fields.push(
    "venue",
    "city",
    "country",
    "slug",
    "song_count",
    "tour_name",
    "tour",
    "venue_link",
    "notes",
    "source"
  );
  if (context.setlistFields.has("source_hash")) fields.push("source_hash");
  if (context.setlistFields.has("setlistfm_id")) fields.push("setlistfm_id");
  if (setlist.id && context.setlistFields.has("setlistfm_id")) {
    const bySetlistFmId = await context.directus.first(
      "setlists",
      { setlistfm_id: { _eq: setlist.id } },
      fields
    );
    if (bySetlistFmId) {
      return bySetlistFmId;
    }
  }
  const date = parseSetlistFmEventDate(setlist.eventDate);
  const venue = setlist.venue.name;
  const city = setlist.venue.city.name;
  const country = setlist.venue.city.country.name;
  const exactVenueMatch = await context.directus.first(
    "setlists",
    {
      date: { _eq: date },
      venue: { _eq: venue },
      city: { _eq: city },
      country: { _eq: country }
    },
    fields
  );
  if (exactVenueMatch) {
    return exactVenueMatch;
  }
  if (context.setlistFields.has("setlistfm_id")) {
    const placeholderCandidates = await context.directus.list(
      "setlists",
      {
        filter: {
          date: { _eq: date },
          country: { _eq: country },
          setlistfm_id: { _null: true },
          song_count: { _eq: 0 }
        },
        fields,
        limit: -1
      }
    );
    const placeholderMatch = findUniqueNormalizedPlaceholder(placeholderCandidates, city);
    if (placeholderMatch) {
      return placeholderMatch;
    }
  }
  return null;
}
__name(findExistingSetlist, "findExistingSetlist");
async function upsertTour(context, setlist) {
  const tourName = setlist.tour?.name?.trim();
  if (!tourName) {
    return null;
  }
  const existingByName = await context.directus.list(
    "tours",
    {
      filter: { name: { _eq: tourName } },
      fields: ["id"],
      sort: "id",
      limit: -1
    }
  );
  if (existingByName.length > 0) {
    return existingByName[0].id;
  }
  const tourSlug = slugify(tourName);
  const existingBySlug = await context.directus.list(
    "tours",
    {
      filter: { slug: { _eq: tourSlug } },
      fields: ["id"],
      sort: "id",
      limit: -1
    }
  );
  if (existingBySlug.length > 0) {
    return existingBySlug[0].id;
  }
  const created = await context.directus.create("tours", {
    name: tourName,
    slug: tourSlug,
    source: context.sourceId
  });
  return created.id;
}
__name(upsertTour, "upsertTour");
async function upsertVenue(context, setlist) {
  const venueName = setlist.venue.name;
  const city = setlist.venue.city.name;
  const country = setlist.venue.city.country.name;
  const date = parseSetlistFmEventDate(setlist.eventDate);
  const existing = await context.directus.first(
    "venues",
    {
      name: { _eq: venueName },
      city: { _eq: city },
      country: { _eq: country }
    },
    ["id", "first_cure_show", "latest_cure_show"]
  );
  if (existing) {
    const updates = {
      last_synced_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (!existing.first_cure_show || String(existing.first_cure_show) > date) {
      updates.first_cure_show = date;
    }
    if (!existing.latest_cure_show || String(existing.latest_cure_show) < date) {
      updates.latest_cure_show = date;
    }
    await context.directus.update("venues", existing.id, updates);
    return existing.id;
  }
  const created = await context.directus.create("venues", {
    name: venueName,
    slug: slugify(`${venueName}-${city}`),
    city,
    state_province: stateProvince(setlist),
    country,
    country_code: setlist.venue.city.country.code ?? null,
    first_cure_show: date,
    latest_cure_show: date,
    cure_show_count: 1,
    source_notes: setlist.url ?? null,
    last_synced_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  return created.id;
}
__name(upsertVenue, "upsertVenue");
function buildSetlistData(context, setlist, existing, date, sourceHash, songCount, tourAssignment, venueId) {
  const isPlaceholderMerge = Boolean(existing && !existing.setlistfm_id && Number(existing.song_count ?? 0) === 0);
  const venue = isPlaceholderMerge ? existing?.venue || setlist.venue.name : setlist.venue.name;
  const city = setlist.venue.city.name;
  const country = setlist.venue.city.country.name;
  const mergedNotes = cleanCompletedShowNotes(setlist.info ?? existing?.notes ?? null, songCount);
  return {
    venue,
    city,
    country,
    date,
    tour_name: tourAssignment.tourName,
    slug: existing?.slug || slugify(`${venue}-${city}-${date}`),
    song_count: songCount,
    notes: mergedNotes,
    source: mergeSource(existing?.source ?? null, setlist.url),
    state_province: stateProvince(setlist),
    tour: tourAssignment.tourId,
    source_id: context.sourceId,
    venue_link: existing?.venue_link ?? venueId,
    country_code: setlist.venue.city.country.code ?? null,
    ...optionalFields(context.setlistFields, {
      setlistfm_id: setlist.id,
      setlistfm_url: setlist.url ?? null,
      setlistfm_last_updated: directusTimestampFromSetlistFm(setlist.lastUpdated),
      source_hash: sourceHash,
      import_source: "setlist.fm"
    })
  };
}
__name(buildSetlistData, "buildSetlistData");
async function repair2026SummerTourData(env, { apply = false } = {}) {
  const directus = new DirectusClient(env);
  const canonicalTour = await directus.first(
    "tours",
    { slug: { _eq: CUREATION_2026_TOUR_SLUG } },
    ["id", "name", "slug"]
  );
  if (!canonicalTour) {
    throw new Error(`Canonical tour ${CUREATION_2026_TOUR_SLUG} was not found`);
  }

  const genericTours = await directus.list("tours", {
    filter: { slug: { _eq: GENERIC_2026_TOUR_SLUG } },
    fields: ["id", "name", "slug"],
    sort: "id",
    limit: -1
  });
  const summerSetlists = await directus.list("setlists", {
    filter: {
      date: {
        _gte: SUMMER_2026_START,
        _lte: SUMMER_2026_END
      }
    },
    fields: [
      "id",
      "date",
      "venue",
      "city",
      "country",
      "state_province",
      "country_code",
      "slug",
      "song_count",
      "notes",
      "source",
      "tour",
      "tour_name",
      "venue_link",
      "setlistfm_id",
      "setlistfm_url",
      "setlistfm_last_updated",
      "source_hash",
      "import_source"
    ],
    sort: ["date", "id"],
    limit: -1
  });

  const groups = new Map();
  for (const setlist of summerSetlists) {
    const key = [
      setlist.date,
      normalizePlaceName(setlist.city),
      normalizePlaceName(setlist.country)
    ].join("|");
    const group = groups.get(key) ?? [];
    group.push(setlist);
    groups.set(key, group);
  }

  const duplicateMerges = [];
  const ambiguousGroups = [];
  for (const [key, group] of groups) {
    const placeholders = group.filter(
      (setlist) => !setlist.setlistfm_id && Number(setlist.song_count ?? 0) === 0
    );
    const imports = group.filter(
      (setlist) => Boolean(setlist.setlistfm_id) && Number(setlist.song_count ?? 0) > 0
    );
    if (placeholders.length === 1 && imports.length === 1) {
      duplicateMerges.push({ key, target: placeholders[0], source: imports[0] });
    } else if (placeholders.length > 0 && imports.length > 0) {
      ambiguousGroups.push({
        key,
        placeholderIds: placeholders.map((setlist) => setlist.id),
        importIds: imports.map((setlist) => setlist.id)
      });
    }
  }

  if (ambiguousGroups.length > 0) {
    throw new Error(`Ambiguous 2026 setlist duplicates: ${JSON.stringify(ambiguousGroups)}`);
  }

  const duplicateSourceIds = new Set(duplicateMerges.map((merge) => merge.source.id));
  const duplicateTargetIds = new Set(duplicateMerges.map((merge) => merge.target.id));
  const tourUpdates = summerSetlists.filter((setlist) => {
    if (duplicateSourceIds.has(setlist.id) || duplicateTargetIds.has(setlist.id)) {
      return false;
    }
    return relationId(setlist.tour) !== canonicalTour.id || setlist.tour_name !== CUREATION_2026_TOUR_NAME;
  });
  const noteUpdates = summerSetlists
    .filter(
      (setlist) => !duplicateSourceIds.has(setlist.id) && !duplicateTargetIds.has(setlist.id)
    )
    .map((setlist) => ({
      id: setlist.id,
      before: setlist.notes ?? null,
      after: cleanCompletedShowNotes(setlist.notes, setlist.song_count)
    }))
    .filter((update) => update.before !== update.after);

  const plannedRemovedSetlistIds = new Set(duplicateSourceIds);
  const plannedCanonicalSetlistIds = new Set([
    ...tourUpdates.map((setlist) => setlist.id),
    ...duplicateTargetIds
  ]);
  const genericTourCleanup = [];
  for (const tour of genericTours) {
    const references = await directus.list("setlists", {
      filter: { tour: { _eq: tour.id } },
      fields: ["id", "date", "venue", "city"],
      sort: ["date", "id"],
      limit: -1
    });
    const unhandledReferenceIds = references
      .map((setlist) => setlist.id)
      .filter(
        (id) => !plannedRemovedSetlistIds.has(id) && !plannedCanonicalSetlistIds.has(id)
      );
    genericTourCleanup.push({
      id: tour.id,
      name: tour.name,
      referenceIds: references.map((setlist) => setlist.id),
      unhandledReferenceIds,
      deletableAfterRepair: unhandledReferenceIds.length === 0
    });
  }

  const plan = {
    apply,
    canonicalTour,
    dateRange: [SUMMER_2026_START, SUMMER_2026_END],
    duplicateMerges: duplicateMerges.map((merge) => ({
      key: merge.key,
      targetId: merge.target.id,
      sourceId: merge.source.id,
      sourceSongCount: Number(merge.source.song_count ?? 0)
    })),
    tourUpdates: tourUpdates.map((setlist) => ({
      id: setlist.id,
      date: setlist.date,
      city: setlist.city,
      fromTourId: relationId(setlist.tour),
      fromTourName: setlist.tour_name
    })),
    noteUpdates,
    genericTourCleanup
  };

  if (!apply) {
    return { plan, applied: null };
  }

  const applied = {
    duplicateMerges: [],
    tourUpdates: [],
    noteUpdates: [],
    deletedTours: [],
    retainedTours: []
  };

  for (const merge of duplicateMerges) {
    const targetSongs = await directus.list("setlist_songs", {
      filter: { setlist: { _eq: merge.target.id } },
      fields: ["id"],
      limit: -1
    });
    const sourceSongs = await directus.list("setlist_songs", {
      filter: { setlist: { _eq: merge.source.id } },
      fields: ["id"],
      sort: "position",
      limit: -1
    });
    if (targetSongs.length !== 0) {
      throw new Error(`Duplicate target ${merge.target.id} unexpectedly has songs`);
    }
    if (sourceSongs.length !== Number(merge.source.song_count ?? 0)) {
      throw new Error(
        `Duplicate source ${merge.source.id} song relation count changed: expected ${merge.source.song_count}, found ${sourceSongs.length}`
      );
    }

    for (const song of sourceSongs) {
      await directus.update("setlist_songs", song.id, { setlist: merge.target.id });
    }

    const mergedNotesSource = String(merge.source.notes ?? "").trim()
      ? merge.source.notes
      : merge.target.notes;
    await directus.update("setlists", merge.target.id, {
      venue: merge.source.venue ?? merge.target.venue,
      city: merge.source.city ?? merge.target.city,
      country: merge.source.country ?? merge.target.country,
      state_province: merge.source.state_province ?? merge.target.state_province,
      country_code: merge.source.country_code ?? merge.target.country_code,
      song_count: merge.source.song_count,
      notes: cleanCompletedShowNotes(mergedNotesSource, merge.source.song_count),
      source: mergeSource(merge.target.source ?? null, merge.source.source),
      tour: canonicalTour.id,
      tour_name: CUREATION_2026_TOUR_NAME,
      venue_link: merge.source.venue_link ?? merge.target.venue_link,
      setlistfm_id: merge.source.setlistfm_id,
      setlistfm_url: merge.source.setlistfm_url,
      setlistfm_last_updated: merge.source.setlistfm_last_updated,
      source_hash: merge.source.source_hash,
      import_source: merge.source.import_source
    });

    const remainingSourceSongs = await directus.list("setlist_songs", {
      filter: { setlist: { _eq: merge.source.id } },
      fields: ["id"],
      limit: 1
    });
    if (remainingSourceSongs.length !== 0) {
      throw new Error(`Duplicate source ${merge.source.id} still has song relations`);
    }
    await directus.delete("setlists", merge.source.id);
    applied.duplicateMerges.push({
      targetId: merge.target.id,
      deletedSourceId: merge.source.id,
      movedSongs: sourceSongs.length
    });
  }

  const noteUpdatesById = new Map(noteUpdates.map((update) => [update.id, update.after]));
  for (const setlist of tourUpdates) {
    const update = {
      tour: canonicalTour.id,
      tour_name: CUREATION_2026_TOUR_NAME
    };
    if (noteUpdatesById.has(setlist.id)) {
      update.notes = noteUpdatesById.get(setlist.id);
    }
    await directus.update("setlists", setlist.id, update);
    applied.tourUpdates.push(setlist.id);
    noteUpdatesById.delete(setlist.id);
  }
  for (const [id, notes] of noteUpdatesById) {
    await directus.update("setlists", id, { notes });
    applied.noteUpdates.push(id);
  }

  for (const tour of genericTourCleanup) {
    const remainingReferences = await directus.list("setlists", {
      filter: { tour: { _eq: tour.id } },
      fields: ["id"],
      limit: -1
    });
    if (!tour.deletableAfterRepair || remainingReferences.length > 0) {
      applied.retainedTours.push({
        id: tour.id,
        remainingReferenceIds: remainingReferences.map((setlist) => setlist.id)
      });
      continue;
    }
    await directus.delete("tours", tour.id);
    applied.deletedTours.push(tour.id);
  }

  return { plan, applied };
}
__name(repair2026SummerTourData, "repair2026SummerTourData");
function mergeSource(existingSource, setlistFmUrl) {
  const sources = [
    ...existingSource ? existingSource.split(/\n+/).map((entry) => entry.trim()) : [],
    setlistFmUrl,
    "https://www.setlist.fm/setlists/the-cure-6bd6b266.html"
  ].filter(Boolean);
  return [...new Set(sources)].join("\n");
}
__name(mergeSource, "mergeSource");
async function replaceSetlistSongs(context, setlistId, setlist) {
  const existingSongs = await context.directus.list("setlist_songs", {
    filter: { setlist: { _eq: setlistId } },
    fields: ["id"],
    limit: -1
  });
  for (const existingSong of existingSongs) {
    await context.directus.delete("setlist_songs", existingSong.id);
  }
  let position = 0;
  for (const [setIndex, set] of sets(setlist).entries()) {
    const setType = setTypeFor(set, setIndex);
    for (const song of set.song ?? []) {
      const songTitle2 = song.name?.trim();
      if (!songTitle2) {
        continue;
      }
      position += 1;
      const notes = songNotes(song);
      const isCover = Boolean(song.cover);
      const shouldLinkSong = !isCover && !song.tape;
      const songId = shouldLinkSong ? await upsertSong(context, songTitle2) : null;
      await context.directus.create("setlist_songs", {
        setlist: setlistId,
        song: songId,
        song_title: songTitle2,
        position,
        set_type: setType,
        notes,
        is_cover: isCover,
        cover_artist: song.cover?.name ?? null,
        is_debut: notes ? /debut/i.test(notes) : false
      });
    }
  }
}
__name(replaceSetlistSongs, "replaceSetlistSongs");
async function upsertSong(context, title) {
  const titleFilter = context.songFields.has("canonical_title") ? { canonical_title: { _eq: title } } : { title: { _eq: title } };
  const fieldList = ["id", "title"];
  if (context.songFields.has("canonical_title")) {
    fieldList.push("canonical_title");
  }
  if (context.songFields.has("setlistfm_title")) {
    fieldList.push("setlistfm_title");
  }
  const existing = await context.directus.first("songs", titleFilter, fieldList) ?? await context.directus.first(
    "songs",
    { title: { _eq: title } },
    fieldList
  );
  if (existing) {
    const updates = optionalFields(context.songFields, {
      canonical_title: existing.canonical_title ?? title,
      setlistfm_title: title
    });
    if (Object.keys(updates).length > 0) {
      await context.directus.update("songs", existing.id, updates);
    }
    return existing.id;
  }
  const created = await context.directus.create("songs", {
    title,
    slug: slugify(title),
    source: context.sourceId,
    ...optionalFields(context.songFields, {
      canonical_title: title,
      setlistfm_title: title
    })
  });
  return created.id;
}
__name(upsertSong, "upsertSong");
async function setlistHash(setlist) {
  return sha256Hex({
    eventDate: setlist.eventDate,
    venue: setlist.venue,
    tour: setlist.tour?.name ?? null,
    info: setlist.info ?? null,
    sets: sets(setlist).map((set) => ({
      name: set.name ?? null,
      encore: set.encore ?? null,
      songs: (set.song ?? []).map((song) => ({
        name: song.name ?? null,
        info: song.info ?? null,
        tape: song.tape ?? false,
        cover: song.cover?.name ?? null,
        with: song.with?.name ?? null
      }))
    }))
  });
}
__name(setlistHash, "setlistHash");
function sets(setlist) {
  return setlist.sets?.set ?? [];
}
__name(sets, "sets");
function countSongs(setlist) {
  return sets(setlist).reduce((total, set) => total + (set.song?.length ?? 0), 0);
}
__name(countSongs, "countSongs");
function stateProvince(setlist) {
  return setlist.venue.city.state ?? setlist.venue.city.stateCode ?? null;
}
__name(stateProvince, "stateProvince");
function songNotes(song) {
  const notes = [
    song.info?.trim(),
    song.tape ? "tape" : null,
    song.with?.name ? `with ${song.with.name}` : null
  ].filter(Boolean);
  return notes.length > 0 ? notes.join("; ") : null;
}
__name(songNotes, "songNotes");
function setTypeFor(set, setIndex) {
  if (set.encore && set.encore > 0) {
    return set.encore === 1 ? "encore" : `encore${set.encore}`;
  }
  return setIndex === 0 ? "main" : `set${setIndex + 1}`;
}
__name(setTypeFor, "setTypeFor");
function maxCheckpoint(left, right) {
  return left > right ? left : right;
}
__name(maxCheckpoint, "maxCheckpoint");

// src/index.ts
var SETLIST_CRON = "15 3 * * *";
var LYRIC_SOCIAL_CRON = "30 6 * * *";
var POST_EVENT_SETLIST_SOCIAL_CRON = "45 * * * *";
var ON_THIS_DAY_SETLIST_SOCIAL_CRON = "15 9 * * *";
var index_default = {
  async scheduled(event, env, ctx) {
    if (event.cron === SETLIST_CRON) {
      ctx.waitUntil(syncSetlists(env));
      return;
    }
    if (event.cron === LYRIC_SOCIAL_CRON) {
      ctx.waitUntil(postLyricOfDay(env, { publish: true }));
      return;
    }
    if (event.cron === POST_EVENT_SETLIST_SOCIAL_CRON) {
      ctx.waitUntil(postRecentEventSetlist(env, { publish: true }));
      return;
    }
    if (event.cron === ON_THIS_DAY_SETLIST_SOCIAL_CRON) {
      ctx.waitUntil(postOnThisDaySetlist(env, { publish: true }));
      return;
    }
    ctx.waitUntil(syncSetlists(env));
  },
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        await publishSocialMediaDraft(env, message.body);
      } catch (error) {
        try {
          await markSocialMediaDraftPublishFailed(env, message.body, error);
        } catch (markError) {
          console.error("Failed to mark social draft publish failure", markError);
        }
      }
    }
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return json({
        ok: true,
        worker: "cureation-automation",
        crons: {
          setlists: SETLIST_CRON,
          lyricSocial: LYRIC_SOCIAL_CRON,
          postEventSetlistSocial: POST_EVENT_SETLIST_SOCIAL_CRON,
          onThisDaySetlistSocial: ON_THIS_DAY_SETLIST_SOCIAL_CRON
        },
        routes: [
          "/tools/social-draft",
          "/tools/social-draft/manifest.webmanifest",
          "/tools/social-draft/sw.js",
          "/tools/social-draft/icon.svg",
          "/run/setlists",
          "/run/enrich-setlists",
          "/run/social/lyric",
          "/run/social/setlists/on-this-day",
          "/run/social/setlists/recent",
          "/run/social/drafts/preview",
          "/run/social/drafts/create",
          "/run/social/drafts/publish",
          "/run/social/drafts/status"
        ]
      });
    }
    if (request.method === "GET" && url.pathname === "/tools/social-draft") {
      return socialDraftPage();
    }
    if (request.method === "GET" && url.pathname === "/tools/social-draft/manifest.webmanifest") {
      return socialDraftManifest();
    }
    if (request.method === "GET" && url.pathname === "/tools/social-draft/sw.js") {
      return socialDraftServiceWorker();
    }
    if (request.method === "GET" && url.pathname === "/tools/social-draft/icon.svg") {
      return socialDraftIcon();
    }
    if (request.method === "POST" && url.pathname === "/run/setlists") {
      const authResponse = authorizeManualRun(request, env);
      if (authResponse) {
        return authResponse;
      }
      return runJob(() => syncSetlists(env));
    }
    if (request.method === "POST" && url.pathname === "/run/enrich-setlists") {
      const authResponse = authorizeManualRun(request, env);
      if (authResponse) {
        return authResponse;
      }
      return runJob(
        () => enrichSetlists(env, {
          force: truthy(url.searchParams.get("force")),
          limit: numberParam(url.searchParams.get("limit")),
          updateMemberSources: truthy(url.searchParams.get("members"))
        })
      );
    }
    if (request.method === "POST" && url.pathname === "/run/social/lyric") {
      const authResponse = authorizeManualRun(request, env);
      if (authResponse) {
        return authResponse;
      }
      return runJob(
        () => postLyricOfDay(env, {
          publish: truthy(url.searchParams.get("publish")),
          channels: channelParams(url)
        })
      );
    }
    if (request.method === "POST" && url.pathname === "/run/social/setlists/on-this-day") {
      const authResponse = authorizeManualRun(request, env);
      if (authResponse) {
        return authResponse;
      }
      return runJob(
        () => postOnThisDaySetlist(env, {
          publish: truthy(url.searchParams.get("publish")),
          force: truthy(url.searchParams.get("force")),
          channels: channelParams(url)
        })
      );
    }
    if (request.method === "POST" && url.pathname === "/run/social/setlists/recent") {
      const authResponse = authorizeManualRun(request, env);
      if (authResponse) {
        return authResponse;
      }
      return runJob(
        () => postRecentEventSetlist(env, {
          publish: truthy(url.searchParams.get("publish")),
          force: truthy(url.searchParams.get("force")),
          channels: channelParams(url)
        })
      );
    }
    if (request.method === "POST" && url.pathname === "/run/social/drafts/preview") {
      const authResponse = authorizeManualRun(request, env);
      if (authResponse) {
        return authResponse;
      }
      return runJob(async () => previewSocialMediaDraft(env, await jsonRequest(request)));
    }
    if (request.method === "POST" && url.pathname === "/run/social/drafts/create") {
      const authResponse = authorizeManualRun(request, env);
      if (authResponse) {
        return authResponse;
      }
      return runJob(async () => createSocialMediaDraft(env, await jsonRequest(request)));
    }
    if (request.method === "POST" && url.pathname === "/run/social/drafts/publish") {
      const authResponse = authorizeManualRun(request, env);
      if (authResponse) {
        return authResponse;
      }
      try {
        const body = await jsonRequest(request);
        const result = await beginSocialMediaDraftPublish(env, body);
        try {
          await env.SOCIAL_DRAFT_QUEUE.send(body);
        } catch (queueError) {
          await markSocialMediaDraftPublishFailed(env, body, queueError);
          throw queueError;
        }
        return json({ ok: true, result }, 202);
      } catch (error) {
        return json({ ok: false, error: errorMessage(error) }, 500);
      }
    }
    if (request.method === "POST" && url.pathname === "/run/social/drafts/status") {
      const authResponse = authorizeManualRun(request, env);
      if (authResponse) {
        return authResponse;
      }
      return runJob(async () => getSocialMediaDraftStatus(env, await jsonRequest(request)));
    }
    return json({ error: "Not found" }, 404);
  }
};
async function runJob(job) {
  try {
    const result = await job();
    return json({ ok: true, result });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error) }, 500);
  }
}
__name(runJob, "runJob");
function authorizeManualRun(request, env) {
  if (!env.MANUAL_RUN_TOKEN) {
    return json({ error: "MANUAL_RUN_TOKEN is not configured" }, 503);
  }
  const expected = `Bearer ${env.MANUAL_RUN_TOKEN}`;
  if (request.headers.get("Authorization") !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }
  return null;
}
__name(authorizeManualRun, "authorizeManualRun");
function truthy(value) {
  return value === "1" || value === "true" || value === "yes";
}
__name(truthy, "truthy");
function numberParam(value) {
  if (!value) {
    return void 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : void 0;
}
__name(numberParam, "numberParam");
function channelParams(url) {
  const channels = url.searchParams.getAll("channel").flatMap((value) => value.split(",")).map((value) => value.trim().toLowerCase()).filter((value) => value === "x" || value === "bluesky");
  return channels.length > 0 ? [...new Set(channels)] : void 0;
}
__name(channelParams, "channelParams");
async function jsonRequest(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Expected application/json request body");
  }
  const body = await request.json();
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("Expected a JSON object request body");
  }
  return body;
}
__name(jsonRequest, "jsonRequest");
function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
__name(json, "json");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map

