from datetime import date
from typing import Optional, Literal
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator


class UserRegister(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    companyName: str = Field(min_length=2, max_length=120)
    role: Literal["shipper", "carrier"] = "shipper"


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ShipmentCreate(BaseModel):
    reference: Optional[str] = Field(default=None, max_length=40)
    cargo: str = Field(min_length=2, max_length=120)
    origin: str = Field(min_length=2, max_length=120)
    destination: str = Field(min_length=2, max_length=120)
    weightTons: float = Field(gt=0, le=100000)
    pickupDate: date
    deliveryDate: date
    notes: Optional[str] = Field(default="", max_length=1000)

    @field_validator("deliveryDate")
    @classmethod
    def delivery_after_pickup(cls, value, info):
        pickup = info.data.get("pickupDate")
        if pickup and value < pickup:
            raise ValueError("Delivery date must be on or after pickup date")
        return value


class ShipmentUpdate(BaseModel):
    reference: Optional[str] = Field(default=None, max_length=40)
    cargo: Optional[str] = Field(default=None, min_length=2, max_length=120)
    origin: Optional[str] = Field(default=None, min_length=2, max_length=120)
    destination: Optional[str] = Field(default=None, min_length=2, max_length=120)
    weightTons: Optional[float] = Field(default=None, gt=0, le=100000)
    pickupDate: Optional[date] = None
    deliveryDate: Optional[date] = None
    notes: Optional[str] = Field(default=None, max_length=1000)
    status: Optional[Literal["Draft", "Booked", "In Transit", "Delayed", "Delivered", "Cancelled"]] = None
