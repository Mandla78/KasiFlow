"""
media -- photos, stored on Cloudinary.

HOW AN UPLOAD WORKS (the phone never sends image bytes to our server):

    phone                         our backend                    Cloudinary
    -----                         -----------                    ----------
    "I want to add a photo"  -->  uploads.start(): records the
                                  upload, signs ONE public_id
                     <--  form fields + URL
    posts the file with those fields  ------------------------->  stores it
    "done: <public_id>"      -->  uploads.finish(): our record
                                  must match (same person, same
                                  purpose, not expired); asks
                                  Cloudinary for the REAL file  -->  facts
                                  (size, URL); limits; saved

  * folders.py        where files live: owner first, keyed, never our ids
  * provider.py       what we need from a storage service (+ get_provider)
  * cloudinary_provider.py / fake_provider.py   the two implementations
  * models.py         media_uploads (every upload, start to finish) and
                      the columns a feature's own image table mixes in
  * uploads.py        start / finish / cancel, and the daily byte limit
  * notifications.py  Cloudinary's signed callbacks (malware-scan verdicts),
                      routed to the feature that owns the file
  * sweep.py          deletes uploads that were started but never finished
  * routes.py, scheduler.py   plug the above into the app

Written for Akayza; TruConnect's media design was the reference (REUSE.md).
Features use uploads.start/finish and folders.*; only cloudinary_provider.py
imports the Cloudinary SDK.
"""
