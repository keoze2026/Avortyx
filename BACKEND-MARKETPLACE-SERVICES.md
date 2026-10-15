# Marketplace → Services directory: backend work

**From:** frontend · **For:** backend developer · **Priority:** ASAP (Sir's request)
**Frontend status:** done and waiting for these endpoints.

---

## 1. Problem statement

Sir wants a **Services directory inside our Marketplace**: a page where our team lists partner websites
(ad networks, servers / hosting / proxies, and more later) for **all our users** to browse, with a logo,
a short description, "More details" and a link to the website.

**Reference Sir showed:** the *Marketplace* of the **Capitalist** wallet (capitalist.net → Other services →
Marketplace). It has tabs *All Services / My Services / Search*, sections like **"Рекламные сети (55)"** and
**"Серверы, хостинги, прокси (20)"**, and a grid of white logo cards with a name, a two-line description and
a green "More details" link. We are building **our own** version of that, not linking to theirs.

**Where it lives in Avortyx:** left menu **Marketplace** → tab **Services**
(`https://app.avortyx.io/marketplace?tab=services`). The other tab, *Live Auctions*, is not affected.

**Today's problem:** the screen is built, but there is no backend for it. Everything staff add is saved
**only in the browser they used**, so other users see an empty page. We need the data on the server so
that what the team adds once is seen by every user on every device.

---

## 2. Who can do what

| Action | Who |
|---|---|
| Browse the directory, open details, visit a website | any signed-in user (admin, staff, buyer, publisher logins) |
| Star a service into **My services** | any signed-in user (each user has their own list) |
| Add / edit / hide / delete services and categories, upload logos | platform staff only: `is_staff` or `is_superuser` → everyone else gets **403** |

The directory is **platform-wide** (the same for every organization), not per organization.

---

## 3. Models + migration (new app `marketplace`)

```python
class ServiceCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=80)                       # English (main)
    name_translations = models.JSONField(default=dict, blank=True)  # {"zh": "...", "ja": "...", "ru": "..."}
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class MarketplaceService(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(ServiceCategory, on_delete=models.CASCADE, related_name='services')
    name = models.CharField(max_length=120)                      # brand name, shown as entered
    description = models.TextField(max_length=1000, blank=True)  # English (main)
    description_translations = models.JSONField(default=dict, blank=True)  # {"zh","ja","ru"}
    website_url = models.URLField(max_length=500)                # may include our referral code
    logo = models.ImageField(upload_to='marketplace/logos/', blank=True, null=True)
    is_active = models.BooleanField(default=True)                # False = hidden from non-staff
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class FavoriteService(models.Model):                             # "My services"
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    service = models.ForeignKey(MarketplaceService, on_delete=models.CASCADE, related_name='favorites')
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        unique_together = ('user', 'service')
```

Order categories and services by `sort_order`, then `name`.
Translations are optional: the frontend shows the user's language when filled, otherwise the English field.
Only the keys `zh`, `ja`, `ru` are allowed; ignore anything else.

---

## 4. Endpoints

| Method | Path | Who | Body |
|---|---|---|---|
| GET | `/api/marketplace/services` | signed in | none |
| POST | `/api/marketplace/categories` | staff | JSON `{ name, sort_order, name_translations }` |
| PATCH | `/api/marketplace/categories/{id}` | staff | JSON, same fields, all optional |
| DELETE | `/api/marketplace/categories/{id}` | staff | none (also deletes its services) |
| POST | `/api/marketplace/services` | staff | **multipart** (create) |
| POST | `/api/marketplace/services/{id}` | staff | **multipart** (update) |
| DELETE | `/api/marketplace/services/{id}` | staff | none |
| POST | `/api/marketplace/services/{id}/favorite` | signed in | none: add to My services (idempotent) |
| DELETE | `/api/marketplace/services/{id}/favorite` | signed in | none: remove (idempotent) |

**Why update is POST, not PATCH:** Django only parses multipart (the logo file) on POST. The frontend
already sends updates as `POST /api/marketplace/services/{id}`.

### Multipart fields (create and update)

| Field | Value |
|---|---|
| `category_id` | uuid |
| `name` | text, required, max 120 |
| `description` | text, max 1000 |
| `description_translations` | **JSON text**, e.g. `{"ru":"...","zh":"..."}`; only filled languages are sent (may be `{}`) |
| `website_url` | `http://` or `https://` link |
| `is_active` | `"true"` / `"false"` |
| `sort_order` | integer as text |
| `logo` | file, optional; omitted = keep the current logo |
| `remove_logo` | `"true"` to clear the logo, optional |

### GET response

```json
{
  "categories": [
    { "id": "uuid", "name": "Ad networks", "sort_order": 10,
      "name_translations": { "ru": "Рекламные сети", "zh": "广告网络", "ja": "広告ネットワーク" } }
  ],
  "services": [
    {
      "id": "uuid",
      "category_id": "uuid",
      "name": "Adsterra",
      "description": "Ad network with direct traffic from all over the world.",
      "description_translations": { "ru": "Надёжная рекламная сеть с прямым трафиком…" },
      "website_url": "https://adsterra.com/?ref=avortyx",
      "logo_url": "https://api.avortyx.io/media/marketplace/logos/adsterra.png",
      "is_active": true,
      "sort_order": 0,
      "is_favorite": false
    }
  ]
}
```

- **Non-staff:** return only `is_active = true` services. **Staff:** return all, including hidden.
- `is_favorite`: true when the **current user** starred it.
- `logo_url`: absolute URL, or a `/media/...` path (the frontend adds the API origin). `null` when there is no logo.
- `POST` create / update return the saved service in the same shape. Category POST / PATCH return the category.
- Errors as `400 { "detail": "..." }`, `403` for non-staff writes, `404` for unknown ids, like the rest of the API.

---

## 5. Validation and safety

- `website_url`: only `http://` or `https://`. Reject `javascript:`, `data:` and anything else (it is rendered as a link).
- `logo`: PNG, JPG, WEBP or SVG, max **1 MB**. SVG can carry script: sanitize it, or serve logos with
  `Content-Type: image/svg+xml` and `Content-Security-Policy: sandbox`. If that is too much work now, allow PNG/JPG/WEBP only and tell frontend.
- Media must be served in production (logos under `/media/marketplace/logos/`).
- `name` required. Translations: strings only, max 80 (category) / 1000 (description), keys `zh`, `ja`, `ru` only.

---

## 6. Optional: seed the list from the reference

To save the team typing, a management command `seed_marketplace` can create these categories and service
**names** (website links, logos and descriptions are then filled in by staff from the portal):

**Ad networks** (`Рекламные сети`, `广告网络`, `広告ネットワーク`): Adskeeper, Wizads, Youtarget, Convertadv, Adcash,
TrafficStars, HilltopAds, MGID, Kaleido Media, ClickAdilla, RichAds, Adsterra, Pushub, EZmob, MyBid, Popcash,
AdsBravo, ReachEffect, EpicAds.Net, Kadam, Power Push, AdProfex, hClicks.com, Pushground, Popunder, OnClickA,
Mobivion, River Traffic, DAO Advertising, AdOperator, ADxAD, Noviclick, Mondiad, RollerAds, Bidvertiser,
Activerevenue, Traffic Nomads, AdsCompass, Mixadvert, Yandex Direct, Google Ads, TacoLoco, Evadav, Adsy.Tech,
ROIads, AdSpyglass, Traforama, Retarg, CliqBetter Ad Network, Afront DSP, myTarget, Directadvert, OctoClick, BuyMedia.

**Servers, hosting, proxies** (`Серверы, хостинги, прокси`, `服务器、主机、代理`, `サーバー・ホスティング・プロキシ`):
CyberYozh APP, PROXYS.IO, SX.ORG, DLine Media, Asocks, Z-PROXY.COM, HostZealot, Inferno Solutions, iProxy.online,
Mobile Proxies (mobileproxy.space), Froxy, ProHoster.info, HostMeNow, VPN.how, LTEBOOST, proxy-solutions.net,
ModJus Shop, Luxury Socks, snowgate cloud, PrivateFlare.

Services created by the seed should start **hidden** (`is_active = false`) until staff add the link and logo.

---

## 7. Done when

1. Staff add a category and a service with a logo on Marketplace → Services; a **non-staff** user sees it after refresh, on another device.
2. Turning **Visible to users** off hides it from non-staff users (staff still see it, faded).
3. A non-staff `POST` / `PATCH` / `DELETE` on categories or services returns **403**.
4. A user stars a service; it appears under **My services** for that user only, also after logging in elsewhere.
5. With the portal in Russian / Chinese / Japanese, category names and descriptions show the translations staff entered.
6. The yellow "this browser only" notice on the Services tab is gone (it disappears by itself once `GET /api/marketplace/services` answers 200).
