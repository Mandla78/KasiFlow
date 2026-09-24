"""payments -- "paying the supplier".

Two ways, chosen by the trader where the supplier allows it:
    PayFast   paid in the app; confirmed by PayFast's ITN callback,
              which is verified before we believe it
    Cash      paid at the door; confirmed by BOTH sides (proof/handshake)

About 1% commission via PayFast split payments. Money in integer cents.
"""
