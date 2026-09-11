/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export enum TimeMode {
  Point = "point",
  Period = "period",
  DayBucketed = "dayBucketed",
}

export enum ReferenceCardinality {
  One = "one",
  Many = "many",
}

export enum FieldDataType {
  Text = "text",
  LongText = "longText",
  Integer = "integer",
  Decimal = "decimal",
  Boolean = "boolean",
  SingleSelect = "singleSelect",
  MultiSelect = "multiSelect",
  Reference = "reference",
}

/** Fields carried by every persisted aggregate. See ADR 0003. */
export interface AggregateMeta {
  /** Client-generated UUID. */
  id: string;
  /** @format date-time */
  createdAt: string;
  /** @format date-time */
  updatedAt: string;
  /**
   * Set when soft-deleted; default reads exclude these rows.
   * @format date-time
   */
  deletedAt: string | null;
  /**
   * Monotonic per-record counter for conflict detection.
   * @format int32
   */
  revision: number;
  ownerId: string;
  userId: string;
}

export interface ApiError {
  code: string;
  message: string;
}

export type BooleanFieldDef = FieldBase & {
  dataType: "boolean";
};

export interface DayBucketedPlacement {
  kind: "dayBucketed";
  /** @format date */
  day: string;
}

export interface Entry {
  /** Client-generated UUID. */
  id: string;
  /** @format date-time */
  createdAt: string;
  /** @format date-time */
  updatedAt: string;
  /**
   * Set when soft-deleted; default reads exclude these rows.
   * @format date-time
   */
  deletedAt: string | null;
  /**
   * Monotonic per-record counter for conflict detection.
   * @format int32
   */
  revision: number;
  ownerId: string;
  userId: string;
  trackerId: string;
  /**
   * The Tracker Version current when this Entry was created. Immutable thereafter.
   * @format int32
   */
  trackerVersion: number;
  /** Zero or one parent; a child's placement always mirrors its parent's. */
  parentEntryId: string | null;
  placement: Placement;
  snapshot: SnapshotField[];
  tags: string[];
}

/**
 * No `trackerVersion` field: the adapter resolves it from the target Tracker's
 * `currentVersion` at creation time — a caller never supplies it. See ADR 0005.
 */
export interface EntryInput {
  trackerId: string;
  parentEntryId: string | null;
  placement: Placement;
  snapshot: SnapshotField[];
  tags: string[];
}

export interface Fadeout {
  /** @format int32 */
  beforeMinutes: number;
  /** @format int32 */
  afterMinutes: number;
}

export interface FieldBase {
  name: string;
  required: boolean;
}

/** One property in a Tracker Version's schema. */
export type FieldDef =
  | TextFieldDef
  | NumberFieldDef
  | BooleanFieldDef
  | SelectFieldDef
  | ReferenceFieldDef;

export type NumberFieldDef = FieldBase & {
  dataType: "integer" | "decimal";
};

export interface PeriodPlacement {
  kind: "period";
  /** @format date-time */
  start: string;
  /** @format date-time */
  end: string;
  fadeout?: Fadeout;
}

export type Placement = PointPlacement | PeriodPlacement | DayBucketedPlacement;

export interface PointPlacement {
  kind: "point";
  /** @format date-time */
  at: string;
  fadeout?: Fadeout;
}

export interface Preset {
  /** Client-generated UUID. */
  id: string;
  /** @format date-time */
  createdAt: string;
  /** @format date-time */
  updatedAt: string;
  /**
   * Set when soft-deleted; default reads exclude these rows.
   * @format date-time
   */
  deletedAt: string | null;
  /**
   * Monotonic per-record counter for conflict detection.
   * @format int32
   */
  revision: number;
  ownerId: string;
  userId: string;
  trackerId: string;
  /**
   * The Tracker Version this Preset's values were authored against.
   * @format int32
   */
  trackerVersion: number;
  name: string;
  values: PresetFieldValue[];
  /** Filled child Entries for reference Fields, resolved depth-first. */
  children: PresetChild[];
}

export interface PresetChild {
  fieldName: string;
  trackerId: string;
  /** @format int32 */
  trackerVersion: number;
  values: PresetFieldValue[];
  children: PresetChild[];
}

export interface PresetFieldValue {
  fieldName: string;
  /** Shape depends on the Field's data type. */
  value: any;
}

export type ReferenceFieldDef = FieldBase & {
  dataType: "reference";
  targetTrackerId: string;
  cardinality: ReferenceCardinality;
};

export type SelectFieldDef = FieldBase & {
  dataType: "singleSelect" | "multiSelect";
  options: string[];
};

/**
 * A Field value frozen onto an Entry. No dataType or schema copy — that's looked up
 * from the Entry's pinned `(trackerId, trackerVersion)` TrackerVersion. See ADR 0005.
 */
export interface SnapshotField {
  fieldName: string;
  value: any;
}

export type TextFieldDef = FieldBase & {
  dataType: "text" | "longText";
};

/**
 * A Tracker's header: identity, metadata, and its current place in its own version
 * history. The Field schema itself lives on `TrackerVersion`, not here. See ADR 0005.
 */
export interface Tracker {
  /** Client-generated UUID. */
  id: string;
  /** @format date-time */
  createdAt: string;
  /** @format date-time */
  updatedAt: string;
  /**
   * Set when soft-deleted; default reads exclude these rows.
   * @format date-time
   */
  deletedAt: string | null;
  /**
   * Monotonic per-record counter for conflict detection.
   * @format int32
   */
  revision: number;
  ownerId: string;
  userId: string;
  name: string;
  defaultTimeMode: TimeMode;
  /**
   * The highest committed TrackerVersion.version. 0 until the first commit.
   * @format int32
   */
  currentVersion: number;
  /** Hidden from "create new" / reference-target pickers; never migrated, never deleted. */
  archived: boolean;
  /** Uncommitted working schema; equals the current Version's fields right after a commit. */
  draftFields: FieldDef[];
}

export interface TrackerCreateInput {
  name: string;
  defaultTimeMode: TimeMode;
  /** Committed immediately as Version 1. */
  fields: FieldDef[];
}

export interface TrackerMetaInput {
  name?: string;
  defaultTimeMode?: TimeMode;
}

/**
 * An immutable, sequentially numbered snapshot of a Tracker's Field schema. Never
 * updated or deleted — an Entry's Snapshot pins to one of these forever. See ADR 0005.
 */
export interface TrackerVersion {
  /** Client-generated UUID. */
  id: string;
  /** @format date-time */
  createdAt: string;
  /** @format date-time */
  updatedAt: string;
  /**
   * Set when soft-deleted; default reads exclude these rows.
   * @format date-time
   */
  deletedAt: string | null;
  /**
   * Monotonic per-record counter for conflict detection.
   * @format int32
   */
  revision: number;
  ownerId: string;
  userId: string;
  trackerId: string;
  /**
   * Sequential per Tracker, starting at 1.
   * @format int32
   */
  version: number;
  fields: FieldDef[];
}

export type QueryParamsType = Record<string | number, any>;
export type ResponseFormat = keyof Omit<Body, "body" | "bodyUsed">;

export interface FullRequestParams extends Omit<RequestInit, "body"> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  type?: ContentType;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseFormat;
  /** request body */
  body?: unknown;
  /** base url */
  baseUrl?: string;
  /** request cancellation token */
  cancelToken?: CancelToken;
}

export type RequestParams = Omit<
  FullRequestParams,
  "body" | "method" | "query" | "path"
>;

export interface ApiConfig<SecurityDataType = unknown> {
  baseUrl?: string;
  baseApiParams?: Omit<RequestParams, "baseUrl" | "cancelToken" | "signal">;
  securityWorker?: (
    securityData: SecurityDataType | null,
  ) => Promise<RequestParams | void> | RequestParams | void;
  customFetch?: typeof fetch;
}

export interface HttpResponse<D extends unknown, E extends unknown = unknown>
  extends Response {
  data: D;
  error: E;
}

type CancelToken = Symbol | string | number;

export enum ContentType {
  Json = "application/json",
  JsonApi = "application/vnd.api+json",
  FormData = "multipart/form-data",
  UrlEncoded = "application/x-www-form-urlencoded",
  Text = "text/plain",
}

export class HttpClient<SecurityDataType = unknown> {
  public baseUrl: string = "";
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>["securityWorker"];
  private abortControllers = new Map<CancelToken, AbortController>();
  private customFetch = (...fetchParams: Parameters<typeof fetch>) =>
    fetch(...fetchParams);

  private baseApiParams: RequestParams = {
    credentials: "same-origin",
    headers: {},
    redirect: "follow",
    referrerPolicy: "no-referrer",
  };

  constructor(apiConfig: ApiConfig<SecurityDataType> = {}) {
    Object.assign(this, apiConfig);
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  protected encodeQueryParam(key: string, value: any) {
    const encodedKey = encodeURIComponent(key);
    return `${encodedKey}=${encodeURIComponent(typeof value === "number" ? value : `${value}`)}`;
  }

  protected addQueryParam(query: QueryParamsType, key: string) {
    return this.encodeQueryParam(key, query[key]);
  }

  protected addArrayQueryParam(query: QueryParamsType, key: string) {
    const value = query[key];
    return value.map((v: any) => this.encodeQueryParam(key, v)).join("&");
  }

  protected toQueryString(rawQuery?: QueryParamsType): string {
    const query = rawQuery || {};
    const keys = Object.keys(query).filter(
      (key) => "undefined" !== typeof query[key],
    );
    return keys
      .map((key) =>
        Array.isArray(query[key])
          ? this.addArrayQueryParam(query, key)
          : this.addQueryParam(query, key),
      )
      .join("&");
  }

  protected addQueryParams(rawQuery?: QueryParamsType): string {
    const queryString = this.toQueryString(rawQuery);
    return queryString ? `?${queryString}` : "";
  }

  private contentFormatters: Record<ContentType, (input: any) => any> = {
    [ContentType.Json]: (input: any) =>
      input !== null && (typeof input === "object" || typeof input === "string")
        ? JSON.stringify(input)
        : input,
    [ContentType.JsonApi]: (input: any) =>
      input !== null && (typeof input === "object" || typeof input === "string")
        ? JSON.stringify(input)
        : input,
    [ContentType.Text]: (input: any) =>
      input !== null && typeof input !== "string"
        ? JSON.stringify(input)
        : input,
    [ContentType.FormData]: (input: any) => {
      if (input instanceof FormData) {
        return input;
      }

      return Object.keys(input || {}).reduce((formData, key) => {
        const property = input[key];
        formData.append(
          key,
          property instanceof Blob
            ? property
            : typeof property === "object" && property !== null
              ? JSON.stringify(property)
              : `${property}`,
        );
        return formData;
      }, new FormData());
    },
    [ContentType.UrlEncoded]: (input: any) => this.toQueryString(input),
  };

  protected mergeRequestParams(
    params1: RequestParams,
    params2?: RequestParams,
  ): RequestParams {
    return {
      ...this.baseApiParams,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...(this.baseApiParams.headers || {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  protected createAbortSignal = (
    cancelToken: CancelToken,
  ): AbortSignal | undefined => {
    if (this.abortControllers.has(cancelToken)) {
      const abortController = this.abortControllers.get(cancelToken);
      if (abortController) {
        return abortController.signal;
      }
      return void 0;
    }

    const abortController = new AbortController();
    this.abortControllers.set(cancelToken, abortController);
    return abortController.signal;
  };

  public abortRequest = (cancelToken: CancelToken) => {
    const abortController = this.abortControllers.get(cancelToken);

    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(cancelToken);
    }
  };

  public request = async <T = any, E = any>({
    body,
    secure,
    path,
    type,
    query,
    format,
    baseUrl,
    cancelToken,
    ...params
  }: FullRequestParams): Promise<HttpResponse<T, E>> => {
    const secureParams =
      ((typeof secure === "boolean" ? secure : this.baseApiParams.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const queryString = query && this.toQueryString(query);
    const payloadFormatter = this.contentFormatters[type || ContentType.Json];
    const responseFormat = format || requestParams.format;

    return this.customFetch(
      `${baseUrl || this.baseUrl || ""}${path}${queryString ? `?${queryString}` : ""}`,
      {
        ...requestParams,
        headers: {
          ...(requestParams.headers || {}),
          ...(type && type !== ContentType.FormData
            ? { "Content-Type": type }
            : {}),
        },
        signal:
          (cancelToken
            ? this.createAbortSignal(cancelToken)
            : requestParams.signal) || null,
        body:
          typeof body === "undefined" || body === null
            ? null
            : payloadFormatter(body),
      },
    ).then(async (response) => {
      const r = response as HttpResponse<T, E>;
      r.data = null as unknown as T;
      r.error = null as unknown as E;

      const responseToParse = responseFormat ? response.clone() : response;
      const data = !responseFormat
        ? r
        : await responseToParse[responseFormat]()
            .then((data) => {
              if (r.ok) {
                r.data = data;
              } else {
                r.error = data;
              }
              return r;
            })
            .catch((e) => {
              r.error = e;
              return r;
            });

      if (cancelToken) {
        this.abortControllers.delete(cancelToken);
      }

      if (!response.ok) throw data;
      return data;
    });
  };
}

/**
 * @title Diary Calendar API
 * @version 0.0.0
 *
 * Diary Calendar API contract — the single source of truth (ADR 0004).
 *
 * This is the starting shape. Evolve it alongside `src/app/data/SPEC.md`; every
 * persisted aggregate must keep the `AggregateMeta` fields (ADR 0003). Regenerate the
 * client after any change: `pnpm --filter @ard/api-spec build` then the client
 * generator script.
 */
export class Api<
  SecurityDataType extends unknown,
> extends HttpClient<SecurityDataType> {
  entries = {
    /**
     * No description
     *
     * @name EntriesList
     * @request GET:/entries
     */
    entriesList: (
      query: {
        /** @format date-time */
        from: string;
        /** @format date-time */
        to: string;
        includeChildren?: boolean;
      },
      params: RequestParams = {},
    ) =>
      this.request<Entry[], any>({
        path: `/entries`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name EntriesCreate
     * @request POST:/entries
     */
    entriesCreate: (data: EntryInput, params: RequestParams = {}) =>
      this.request<Entry, any>({
        path: `/entries`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name EntriesRead
     * @request GET:/entries/{id}
     */
    entriesRead: (id: string, params: RequestParams = {}) =>
      this.request<Entry, ApiError>({
        path: `/entries/${id}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name EntriesUpdate
     * @request PATCH:/entries/{id}
     */
    entriesUpdate: (id: string, data: EntryInput, params: RequestParams = {}) =>
      this.request<Entry, ApiError>({
        path: `/entries/${id}`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name EntriesRemove
     * @request DELETE:/entries/{id}
     */
    entriesRemove: (id: string, params: RequestParams = {}) =>
      this.request<void, ApiError>({
        path: `/entries/${id}`,
        method: "DELETE",
        ...params,
      }),
  };
  presets = {
    /**
     * No description
     *
     * @name PresetsList
     * @request GET:/presets
     */
    presetsList: (
      query: {
        trackerId: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<Preset[], any>({
        path: `/presets`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name PresetsCreate
     * @request POST:/presets
     */
    presetsCreate: (data: Preset, params: RequestParams = {}) =>
      this.request<Preset, any>({
        path: `/presets`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name PresetsUpdate
     * @request PATCH:/presets/{id}
     */
    presetsUpdate: (id: string, data: Preset, params: RequestParams = {}) =>
      this.request<Preset, ApiError>({
        path: `/presets/${id}`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name PresetsRemove
     * @request DELETE:/presets/{id}
     */
    presetsRemove: (id: string, params: RequestParams = {}) =>
      this.request<void, ApiError>({
        path: `/presets/${id}`,
        method: "DELETE",
        ...params,
      }),
  };
  tags = {
    /**
     * No description
     *
     * @name TagsList
     * @request GET:/tags
     */
    tagsList: (
      query?: {
        prefix?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<string[], any>({
        path: `/tags`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),
  };
  trackers = {
    /**
     * No description
     *
     * @name TrackersList
     * @request GET:/trackers
     */
    trackersList: (params: RequestParams = {}) =>
      this.request<Tracker[], any>({
        path: `/trackers`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Creates the Tracker header and commits its Field schema as Version 1.
     *
     * @name TrackersCreate
     * @request POST:/trackers
     */
    trackersCreate: (data: TrackerCreateInput, params: RequestParams = {}) =>
      this.request<Tracker, any>({
        path: `/trackers`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name TrackersRead
     * @request GET:/trackers/{id}
     */
    trackersRead: (id: string, params: RequestParams = {}) =>
      this.request<Tracker, ApiError>({
        path: `/trackers/${id}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Renames / changes default Time mode. Never versions.
     *
     * @name TrackersUpdateMeta
     * @request PATCH:/trackers/{id}
     */
    trackersUpdateMeta: (
      id: string,
      data: TrackerMetaInput,
      params: RequestParams = {},
    ) =>
      this.request<Tracker, ApiError>({
        path: `/trackers/${id}`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name TrackersArchive
     * @request POST:/trackers/{id}/archive
     */
    trackersArchive: (id: string, params: RequestParams = {}) =>
      this.request<Tracker, ApiError>({
        path: `/trackers/${id}/archive`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * @description Replaces the working Draft. Does not version until `commitDraft` is called.
     *
     * @name TrackersSaveDraft
     * @request PUT:/trackers/{id}/draft
     */
    trackersSaveDraft: (
      id: string,
      data: FieldDef[],
      params: RequestParams = {},
    ) =>
      this.request<Tracker, ApiError>({
        path: `/trackers/${id}/draft`,
        method: "PUT",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Mints `currentVersion + 1` iff the Draft differs from the current Version.
     *
     * @name TrackersCommitDraft
     * @request POST:/trackers/{id}/draft/commit
     */
    trackersCommitDraft: (id: string, params: RequestParams = {}) =>
      this.request<Tracker, ApiError>({
        path: `/trackers/${id}/draft/commit`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * @description Clears the working Draft, reverting to the current Version. No-op if there is none.
     *
     * @name TrackersDiscardDraft
     * @request POST:/trackers/{id}/draft/discard
     */
    trackersDiscardDraft: (id: string, params: RequestParams = {}) =>
      this.request<Tracker, ApiError>({
        path: `/trackers/${id}/draft/discard`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name TrackersUnarchive
     * @request POST:/trackers/{id}/unarchive
     */
    trackersUnarchive: (id: string, params: RequestParams = {}) =>
      this.request<Tracker, ApiError>({
        path: `/trackers/${id}/unarchive`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name TrackersReadVersion
     * @request GET:/trackers/{id}/versions/{version}
     */
    trackersReadVersion: (
      id: string,
      version: number,
      params: RequestParams = {},
    ) =>
      this.request<TrackerVersion, ApiError>({
        path: `/trackers/${id}/versions/${version}`,
        method: "GET",
        format: "json",
        ...params,
      }),
  };
}
