# Marketplace → Services directory: backend work

**From:** frontend · **For:** backend developer · **Priority:** ASAP (boss request)
**Frontend status:** done. Marketplace now has two tabs: **Live Auctions** (unchanged) and **Services**. Until the endpoints below exist, staff edits on the Services tab are kept **in the admin's browser only** and the tab shows a yellow notice saying so. As soon as `GET /api/marketplace/services` returns 200, the frontend switches to the backend by itself.

---

## What it is
A directory of partner websites (ad networks, hosting, proxies...) that platform staff list for **every user** to browse. It is platform-wide, not per organization.

- **Read:** any signed-in user.
- **Write:** platform staff only (`is_staff` or `is_superuser`). Everyone else gets 403.

---

## 1. Models + migration (new app `marketplace`)

```python
class ServiceCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=80)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class MarketplaceService(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(ServiceCategory, on_delete=models.CASCADE, related_name='services')
    name = models.CharField(max_length=120)
    description = models.TextField(max_length=1000, blank=True)
    website_url = models.URLField(max_length=500)
    logo = models.ImageField(upload_to='marketplace/logos/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

Order both by `sort_order`, then `name`.

---

## 2. Endpoints

| Method | Path | Who | Body |
|---|---|---|---|
| GET | `/api/marketplace/services` | signed in | none |
| POST | `/api/marketplace/categories` | staff | JSON `{ name, sort_order }` |
| PATCH | `/api/marketplace/categories/{id}` | staff | JSON `{ name?, sort_order? }` |
| DELETE | `/api/marketplace/categories/{id}` | staff | none (also deletes its services) |
| POST | `/api/marketplace/services` | staff | **multipart** (below) |
| PATCH | `/api/marketplace/services/{id}` | staff | **multipart** (below) |
| DELETE | `/api/marketplace/services/{id}` | staff | none |

**Multipart fields** for POST/PATCH services:
`category_id`, `name`, `description`, `website_url`, `is_active` (`"true"`/`"false"`), `sort_order`, `logo` (file, optional), `remove_logo` (`"true"` to clear the logo, optional).
Note: Django does not parse multipart on PATCH by default. Parse it explicitly (e.g. `MultiPartParser`) or accept the same body on `POST /api/marketplace/services/{id}` and tell frontend.

### GET response

```json
{
  "categories": [
    { "id": "uuid", "name": "Ad Networks", "sort_order": 10 }
  ],
  "services": [
    {
      "id": "uuid",
      "category_id": "uuid",
      "name": "Adsterra",
      "description": "Ad network with direct traffic...",
      "website_url": "https://adsterra.com",
      "logo_url": "https://api.avortyx.io/media/marketplace/logos/adsterra.png",
      "is_active": true,
      "sort_order": 0
    }
  ]
}
```

- Non-staff: return **only `is_active=true`** services.
- Staff: return all, including hidden.
- `logo_url`: absolute URL, or a `/media/...` path (frontend adds the API origin). `null` when no logo.
- POST/PATCH return the saved service in the same shape.

---

## 3. Validation
- `website_url` must be `http://` or `https://`. Reject `javascript:` and anything else (it is rendered as a link).
- `logo`: PNG, JPG, WEBP or SVG, max **1 MB**. If SVG is allowed, sanitize it or serve it with `Content-Type: image/svg+xml` and `Content-Security-Policy: sandbox`, since an SVG can carry script.
- `name` required, max 120. `description` max 1000.
- Errors as `400 { "detail": "..." }`, like the rest of the API.

## 4. Done when
1. Staff add a category and a service with a logo on the Services tab; another non-staff user sees it after refresh.
2. Turning "Visible to users" off hides it from non-staff users.
3. A non-staff POST/PATCH/DELETE returns 403.
4. The yellow "this browser only" notice is gone.
