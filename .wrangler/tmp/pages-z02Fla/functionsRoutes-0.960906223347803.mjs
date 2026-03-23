import { onRequestPost as __api_trips__id__audit__aid__rollback_ts_onRequestPost } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\trips\\[id]\\audit\\[aid]\\rollback.ts"
import { onRequestPost as __api_trips__id__entries__eid__restaurants_ts_onRequestPost } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\trips\\[id]\\entries\\[eid]\\restaurants.ts"
import { onRequestPost as __api_trips__id__entries__eid__shopping_ts_onRequestPost } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\trips\\[id]\\entries\\[eid]\\shopping.ts"
import { onRequestPost as __api_trips__id__hotels__hid__shopping_ts_onRequestPost } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\trips\\[id]\\hotels\\[hid]\\shopping.ts"
import { onRequestGet as __api_trips__id__days__num__ts_onRequestGet } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\trips\\[id]\\days\\[num].ts"
import { onRequestPut as __api_trips__id__days__num__ts_onRequestPut } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\trips\\[id]\\days\\[num].ts"
import { onRequestGet as __api_trips__id__docs__type__ts_onRequestGet } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\trips\\[id]\\docs\\[type].ts"
import { onRequestPut as __api_trips__id__docs__type__ts_onRequestPut } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\trips\\[id]\\docs\\[type].ts"
import { onRequestDelete as __api_trips__id__entries__eid__ts_onRequestDelete } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\trips\\[id]\\entries\\[eid].ts"
import { onRequestPatch as __api_trips__id__entries__eid__ts_onRequestPatch } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\trips\\[id]\\entries\\[eid].ts"
import { onRequestDelete as __api_trips__id__restaurants__rid__ts_onRequestDelete } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\trips\\[id]\\restaurants\\[rid].ts"
import { onRequestPatch as __api_trips__id__restaurants__rid__ts_onRequestPatch } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\trips\\[id]\\restaurants\\[rid].ts"
import { onRequestDelete as __api_trips__id__shopping__sid__ts_onRequestDelete } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\trips\\[id]\\shopping\\[sid].ts"
import { onRequestPatch as __api_trips__id__shopping__sid__ts_onRequestPatch } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\trips\\[id]\\shopping\\[sid].ts"
import { onRequestGet as __api_trips__id__audit_ts_onRequestGet } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\trips\\[id]\\audit.ts"
import { onRequestGet as __api_trips__id__days_ts_onRequestGet } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\trips\\[id]\\days.ts"
import { onRequestDelete as __api_permissions__id__ts_onRequestDelete } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\permissions\\[id].ts"
import { onRequestPatch as __api_requests__id__ts_onRequestPatch } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\requests\\[id].ts"
import { onRequestGet as __api_trips__id__ts_onRequestGet } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\trips\\[id].ts"
import { onRequestPut as __api_trips__id__ts_onRequestPut } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\trips\\[id].ts"
import { onRequestGet as __api_my_trips_ts_onRequestGet } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\my-trips.ts"
import { onRequestGet as __api_permissions_ts_onRequestGet } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\permissions.ts"
import { onRequestPost as __api_permissions_ts_onRequestPost } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\permissions.ts"
import { onRequestGet as __api_requests_ts_onRequestGet } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\requests.ts"
import { onRequestPost as __api_requests_ts_onRequestPost } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\requests.ts"
import { onRequestGet as __api_trips_ts_onRequestGet } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\trips.ts"
import { onRequest as __api__middleware_ts_onRequest } from "C:\\Users\\RayChiu\\Desktop\\Source\\GithubRepos\\trip-planner\\functions\\api\\_middleware.ts"

export const routes = [
    {
      routePath: "/api/trips/:id/audit/:aid/rollback",
      mountPath: "/api/trips/:id/audit/:aid",
      method: "POST",
      middlewares: [],
      modules: [__api_trips__id__audit__aid__rollback_ts_onRequestPost],
    },
  {
      routePath: "/api/trips/:id/entries/:eid/restaurants",
      mountPath: "/api/trips/:id/entries/:eid",
      method: "POST",
      middlewares: [],
      modules: [__api_trips__id__entries__eid__restaurants_ts_onRequestPost],
    },
  {
      routePath: "/api/trips/:id/entries/:eid/shopping",
      mountPath: "/api/trips/:id/entries/:eid",
      method: "POST",
      middlewares: [],
      modules: [__api_trips__id__entries__eid__shopping_ts_onRequestPost],
    },
  {
      routePath: "/api/trips/:id/hotels/:hid/shopping",
      mountPath: "/api/trips/:id/hotels/:hid",
      method: "POST",
      middlewares: [],
      modules: [__api_trips__id__hotels__hid__shopping_ts_onRequestPost],
    },
  {
      routePath: "/api/trips/:id/days/:num",
      mountPath: "/api/trips/:id/days",
      method: "GET",
      middlewares: [],
      modules: [__api_trips__id__days__num__ts_onRequestGet],
    },
  {
      routePath: "/api/trips/:id/days/:num",
      mountPath: "/api/trips/:id/days",
      method: "PUT",
      middlewares: [],
      modules: [__api_trips__id__days__num__ts_onRequestPut],
    },
  {
      routePath: "/api/trips/:id/docs/:type",
      mountPath: "/api/trips/:id/docs",
      method: "GET",
      middlewares: [],
      modules: [__api_trips__id__docs__type__ts_onRequestGet],
    },
  {
      routePath: "/api/trips/:id/docs/:type",
      mountPath: "/api/trips/:id/docs",
      method: "PUT",
      middlewares: [],
      modules: [__api_trips__id__docs__type__ts_onRequestPut],
    },
  {
      routePath: "/api/trips/:id/entries/:eid",
      mountPath: "/api/trips/:id/entries",
      method: "DELETE",
      middlewares: [],
      modules: [__api_trips__id__entries__eid__ts_onRequestDelete],
    },
  {
      routePath: "/api/trips/:id/entries/:eid",
      mountPath: "/api/trips/:id/entries",
      method: "PATCH",
      middlewares: [],
      modules: [__api_trips__id__entries__eid__ts_onRequestPatch],
    },
  {
      routePath: "/api/trips/:id/restaurants/:rid",
      mountPath: "/api/trips/:id/restaurants",
      method: "DELETE",
      middlewares: [],
      modules: [__api_trips__id__restaurants__rid__ts_onRequestDelete],
    },
  {
      routePath: "/api/trips/:id/restaurants/:rid",
      mountPath: "/api/trips/:id/restaurants",
      method: "PATCH",
      middlewares: [],
      modules: [__api_trips__id__restaurants__rid__ts_onRequestPatch],
    },
  {
      routePath: "/api/trips/:id/shopping/:sid",
      mountPath: "/api/trips/:id/shopping",
      method: "DELETE",
      middlewares: [],
      modules: [__api_trips__id__shopping__sid__ts_onRequestDelete],
    },
  {
      routePath: "/api/trips/:id/shopping/:sid",
      mountPath: "/api/trips/:id/shopping",
      method: "PATCH",
      middlewares: [],
      modules: [__api_trips__id__shopping__sid__ts_onRequestPatch],
    },
  {
      routePath: "/api/trips/:id/audit",
      mountPath: "/api/trips/:id",
      method: "GET",
      middlewares: [],
      modules: [__api_trips__id__audit_ts_onRequestGet],
    },
  {
      routePath: "/api/trips/:id/days",
      mountPath: "/api/trips/:id",
      method: "GET",
      middlewares: [],
      modules: [__api_trips__id__days_ts_onRequestGet],
    },
  {
      routePath: "/api/permissions/:id",
      mountPath: "/api/permissions",
      method: "DELETE",
      middlewares: [],
      modules: [__api_permissions__id__ts_onRequestDelete],
    },
  {
      routePath: "/api/requests/:id",
      mountPath: "/api/requests",
      method: "PATCH",
      middlewares: [],
      modules: [__api_requests__id__ts_onRequestPatch],
    },
  {
      routePath: "/api/trips/:id",
      mountPath: "/api/trips",
      method: "GET",
      middlewares: [],
      modules: [__api_trips__id__ts_onRequestGet],
    },
  {
      routePath: "/api/trips/:id",
      mountPath: "/api/trips",
      method: "PUT",
      middlewares: [],
      modules: [__api_trips__id__ts_onRequestPut],
    },
  {
      routePath: "/api/my-trips",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_my_trips_ts_onRequestGet],
    },
  {
      routePath: "/api/permissions",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_permissions_ts_onRequestGet],
    },
  {
      routePath: "/api/permissions",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_permissions_ts_onRequestPost],
    },
  {
      routePath: "/api/requests",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_requests_ts_onRequestGet],
    },
  {
      routePath: "/api/requests",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_requests_ts_onRequestPost],
    },
  {
      routePath: "/api/trips",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_trips_ts_onRequestGet],
    },
  {
      routePath: "/api",
      mountPath: "/api",
      method: "",
      middlewares: [__api__middleware_ts_onRequest],
      modules: [],
    },
  ]