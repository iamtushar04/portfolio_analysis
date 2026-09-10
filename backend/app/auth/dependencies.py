import uuid
from typing import Union
from jose import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

# This token url is just for swagger UI locally, we actually login via the external microservice
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

def decode_access_token(token: str) -> Union[str, None]:
    if not token:
        return None
    try:
        # Decode the token without verifying the signature because it is 
        # signed by the external microservice, not our local secret.
        decoded_token = jwt.decode(token, "", options={"verify_signature": False})
        
        # Extract user identifier from the external token
        external_id = decoded_token.get("sub") or decoded_token.get("id") or decoded_token.get("user_id")
        if not external_id:
            return None
        
        # Convert the external numeric ID into a stable, deterministic UUID.
        deterministic_uuid = uuid.uuid5(uuid.NAMESPACE_URL, f"wissen:{external_id}")
        return str(deterministic_uuid)
    except Exception as e:
        print(f"Token decode error: {e}")
        return None

def get_current_user_id(token: str = Depends(oauth2_scheme)) -> str:
    user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id
