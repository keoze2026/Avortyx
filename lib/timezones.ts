/**
 * Comprehensive timezone list used by every timezone selector in the app
 * (reports toolbar, workspace settings, campaign builder, etc.).
 *
 * Each entry pairs an IANA identifier (the canonical machine name) with a
 * human-readable label that includes the UTC offset and one or more
 * representative cities. The list is ordered west-to-east by UTC offset so
 * dropdowns read naturally.
 */

export interface TimezoneOption {
  /** IANA timezone identifier, e.g. "America/Los_Angeles" */
  iana: string;
  /** Display label with UTC offset prefix */
  label: string;
}

export const TIMEZONES: readonly TimezoneOption[] = [
  // ─── Western hemisphere ───
  { iana: "Pacific/Midway", label: "(UTC−11:00) Midway, American Samoa" },
  { iana: "Pacific/Honolulu", label: "(UTC−10:00) Hawaii" },
  { iana: "America/Anchorage", label: "(UTC−09:00) Alaska" },
  { iana: "America/Los_Angeles", label: "(UTC−08:00) Pacific Time (US & Canada)" },
  { iana: "America/Tijuana", label: "(UTC−08:00) Tijuana" },
  { iana: "America/Denver", label: "(UTC−07:00) Mountain Time (US & Canada)" },
  { iana: "America/Phoenix", label: "(UTC−07:00) Arizona" },
  { iana: "America/Chihuahua", label: "(UTC−07:00) Chihuahua, La Paz, Mazatlan" },
  { iana: "America/Chicago", label: "(UTC−06:00) Central Time (US & Canada)" },
  { iana: "America/Mexico_City", label: "(UTC−06:00) Mexico City, Monterrey" },
  { iana: "America/Guatemala", label: "(UTC−06:00) Central America" },
  { iana: "America/New_York", label: "(UTC−05:00) Eastern Time (US & Canada)" },
  { iana: "America/Bogota", label: "(UTC−05:00) Bogota, Lima, Quito" },
  { iana: "America/Indiana/Indianapolis", label: "(UTC−05:00) Indiana (East)" },
  { iana: "America/Halifax", label: "(UTC−04:00) Atlantic Time (Canada)" },
  { iana: "America/Caracas", label: "(UTC−04:00) Caracas" },
  { iana: "America/La_Paz", label: "(UTC−04:00) La Paz" },
  { iana: "America/Santiago", label: "(UTC−04:00) Santiago" },
  { iana: "America/St_Johns", label: "(UTC−03:30) Newfoundland" },
  { iana: "America/Sao_Paulo", label: "(UTC−03:00) Brasilia" },
  { iana: "America/Argentina/Buenos_Aires", label: "(UTC−03:00) Buenos Aires" },
  { iana: "America/Godthab", label: "(UTC−03:00) Greenland" },
  { iana: "America/Montevideo", label: "(UTC−03:00) Montevideo" },
  { iana: "Atlantic/South_Georgia", label: "(UTC−02:00) Mid-Atlantic" },
  { iana: "Atlantic/Azores", label: "(UTC−01:00) Azores" },
  { iana: "Atlantic/Cape_Verde", label: "(UTC−01:00) Cape Verde" },

  // ─── UTC / Europe / Africa ───
  { iana: "Etc/UTC", label: "(UTC+00:00) Coordinated Universal Time" },
  { iana: "Europe/London", label: "(UTC+00:00) London, Edinburgh, Dublin" },
  { iana: "Europe/Lisbon", label: "(UTC+00:00) Lisbon" },
  { iana: "Africa/Casablanca", label: "(UTC+00:00) Casablanca, Monrovia" },
  { iana: "Europe/Berlin", label: "(UTC+01:00) Amsterdam, Berlin, Vienna" },
  { iana: "Europe/Paris", label: "(UTC+01:00) Brussels, Paris, Madrid" },
  { iana: "Europe/Rome", label: "(UTC+01:00) Rome, Belgrade, Bratislava" },
  { iana: "Europe/Warsaw", label: "(UTC+01:00) Warsaw, Prague, Budapest" },
  { iana: "Africa/Lagos", label: "(UTC+01:00) West Central Africa (Lagos)" },
  { iana: "Europe/Athens", label: "(UTC+02:00) Athens, Bucharest, Sofia" },
  { iana: "Europe/Helsinki", label: "(UTC+02:00) Helsinki, Kyiv, Riga" },
  { iana: "Europe/Istanbul", label: "(UTC+03:00) Istanbul" },
  { iana: "Asia/Jerusalem", label: "(UTC+02:00) Jerusalem" },
  { iana: "Africa/Cairo", label: "(UTC+02:00) Cairo" },
  { iana: "Africa/Johannesburg", label: "(UTC+02:00) Harare, Pretoria" },
  { iana: "Europe/Moscow", label: "(UTC+03:00) Moscow, St. Petersburg" },
  { iana: "Asia/Riyadh", label: "(UTC+03:00) Kuwait, Riyadh" },
  { iana: "Africa/Nairobi", label: "(UTC+03:00) Nairobi" },
  { iana: "Asia/Tehran", label: "(UTC+03:30) Tehran" },
  { iana: "Asia/Dubai", label: "(UTC+04:00) Abu Dhabi, Muscat" },
  { iana: "Asia/Baku", label: "(UTC+04:00) Baku, Tbilisi, Yerevan" },
  { iana: "Asia/Kabul", label: "(UTC+04:30) Kabul" },
  { iana: "Asia/Karachi", label: "(UTC+05:00) Islamabad, Karachi" },
  { iana: "Asia/Tashkent", label: "(UTC+05:00) Tashkent" },
  { iana: "Asia/Kolkata", label: "(UTC+05:30) Chennai, Kolkata, Mumbai, New Delhi" },
  { iana: "Asia/Colombo", label: "(UTC+05:30) Sri Jayawardenepura" },
  { iana: "Asia/Kathmandu", label: "(UTC+05:45) Kathmandu" },
  { iana: "Asia/Dhaka", label: "(UTC+06:00) Astana, Dhaka" },
  { iana: "Asia/Almaty", label: "(UTC+06:00) Almaty, Novosibirsk" },
  { iana: "Asia/Yangon", label: "(UTC+06:30) Yangon (Rangoon)" },
  { iana: "Asia/Bangkok", label: "(UTC+07:00) Bangkok, Hanoi, Jakarta" },
  { iana: "Asia/Krasnoyarsk", label: "(UTC+07:00) Krasnoyarsk" },
  { iana: "Asia/Shanghai", label: "(UTC+08:00) Beijing, Chongqing, Hong Kong" },
  { iana: "Asia/Singapore", label: "(UTC+08:00) Kuala Lumpur, Singapore" },
  { iana: "Asia/Taipei", label: "(UTC+08:00) Taipei" },
  { iana: "Australia/Perth", label: "(UTC+08:00) Perth" },
  { iana: "Asia/Tokyo", label: "(UTC+09:00) Osaka, Sapporo, Tokyo" },
  { iana: "Asia/Seoul", label: "(UTC+09:00) Seoul" },
  { iana: "Asia/Pyongyang", label: "(UTC+09:00) Pyongyang" },
  { iana: "Australia/Darwin", label: "(UTC+09:30) Darwin" },
  { iana: "Australia/Adelaide", label: "(UTC+09:30) Adelaide" },
  { iana: "Australia/Sydney", label: "(UTC+10:00) Canberra, Melbourne, Sydney" },
  { iana: "Australia/Brisbane", label: "(UTC+10:00) Brisbane" },
  { iana: "Pacific/Guam", label: "(UTC+10:00) Guam, Port Moresby" },
  { iana: "Pacific/Noumea", label: "(UTC+11:00) New Caledonia, Solomon Is." },
  { iana: "Asia/Magadan", label: "(UTC+11:00) Magadan" },
  { iana: "Pacific/Auckland", label: "(UTC+12:00) Auckland, Wellington" },
  { iana: "Pacific/Fiji", label: "(UTC+12:00) Fiji" },
  { iana: "Pacific/Tongatapu", label: "(UTC+13:00) Nuku'alofa" },
  { iana: "Pacific/Apia", label: "(UTC+13:00) Samoa" },
  { iana: "Pacific/Kiritimati", label: "(UTC+14:00) Kiritimati" },
] as const;

/** Quick lookup by IANA id — used to render a stored value's label. */
export const TIMEZONE_BY_IANA: Record<string, TimezoneOption> = Object.fromEntries(
  TIMEZONES.map((t) => [t.iana, t]),
);

/** Quick lookup by label — used by toolbar that stores the label string. */
export const TIMEZONE_BY_LABEL: Record<string, TimezoneOption> = Object.fromEntries(
  TIMEZONES.map((t) => [t.label, t]),
);

/**
 * Timezone every reporting surface renders call timestamps in until the
 * operator picks another one in the Reports toolbar.
 *
 * UTC — deliberately. The backend sends instants tagged `Z` (contract §1.5),
 * so rendering in UTC shows the operator exactly the wall-clock time the CDR
 * carries, with no offset applied on top of it. Rendering in the browser's
 * own zone silently re-based every row by the viewer's UTC offset, which is
 * what made call times read 8 hours late for operators in UTC+8.
 */
export const DEFAULT_DISPLAY_TIMEZONE = "Etc/UTC";
