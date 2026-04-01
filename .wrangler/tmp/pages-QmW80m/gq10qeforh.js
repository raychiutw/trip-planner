// <define:__ROUTES__>
var define_ROUTES_default = {
  version: 1,
  include: ["/api/*", "/trip/*"],
  exclude: ["/assets/*", "/icons/*", "/manifest.json"]
};

// node_modules/wrangler/templates/pages-dev-pipeline.ts
import worker from "C:\\Users\\Ray\\Desktop\\GitHub\\trip-planner\\.wrangler\\tmp\\pages-QmW80m\\functionsWorker-0.16002018011760244.mjs";
import { isRoutingRuleMatch } from "C:\\Users\\Ray\\Desktop\\GitHub\\trip-planner\\node_modules\\wrangler\\templates\\pages-dev-util.ts";
export * from "C:\\Users\\Ray\\Desktop\\GitHub\\trip-planner\\.wrangler\\tmp\\pages-QmW80m\\functionsWorker-0.16002018011760244.mjs";
var routes = define_ROUTES_default;
var pages_dev_pipeline_default = {
  fetch(request, env, context) {
    const { pathname } = new URL(request.url);
    for (const exclude of routes.exclude) {
      if (isRoutingRuleMatch(pathname, exclude)) {
        return env.ASSETS.fetch(request);
      }
    }
    for (const include of routes.include) {
      if (isRoutingRuleMatch(pathname, include)) {
        const workerAsHandler = worker;
        if (workerAsHandler.fetch === void 0) {
          throw new TypeError("Entry point missing `fetch` handler");
        }
        return workerAsHandler.fetch(request, env, context);
      }
    }
    return env.ASSETS.fetch(request);
  }
};
export {
  pages_dev_pipeline_default as default
};
//# sourceMappingURL=gq10qeforh.js.map
