"""
geocoding -- address search and lookup for the app's location picker.

The app never holds the Mapbox token: it asks OUR backend, which asks
Mapbox (MAPBOX_TOKEN in backend/.env). Three calls, all for a signed-in
user, all rate limited:

  suggest(q)            typeahead while the user types (South Africa only)
  retrieve(id)          the coordinates of a tapped suggestion -- used only
                        to CENTRE the map; the user always places the pin
  reverse(lat, lng)     an address guess for the pin, to pre-fill the
                        fields the user then edits (never stored as-is)

Mapbox is one implementation (mapbox.py); routes.py plugs it into /api/v1.
"""
