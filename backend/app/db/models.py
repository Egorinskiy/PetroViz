"""ORM-модели: User, Well, WellAccess, AuditLog."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, Enum as SAEnum, ForeignKey, Index, JSON,
    String, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    GEOPHYSICIST = "geophysicist"
    VIEWER = "viewer"


class WellPermission(str, enum.Enum):
    READ = "read"
    WRITE = "write"
    OWNER = "owner"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    role: Mapped[UserRole] = mapped_column(
        SAEnum(
            UserRole,
            name="user_role",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=UserRole.VIEWER,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    owned_wells: Mapped[list["Well"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan",
        foreign_keys="Well.owner_id",
    )
    shared_wells: Mapped[list["WellAccess"]] = relationship(
        back_populates="user", cascade="all, delete-orphan",
    )
    audit_entries: Mapped[list["AuditLog"]] = relationship(
        back_populates="user", cascade="all, delete-orphan",
    )


class Well(Base, TimestampMixin):
    __tablename__ = "wells"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    well_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    start_depth: Mapped[float] = mapped_column(nullable=False)
    stop_depth: Mapped[float] = mapped_column(nullable=False)
    step: Mapped[float | None] = mapped_column(nullable=True)
    num_samples: Mapped[int] = mapped_column(nullable=False)
    depth_mnemonic: Mapped[str | None] = mapped_column(String(64), nullable=True)
    curves: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    data_path: Mapped[str] = mapped_column(String(512), nullable=False)

    owner: Mapped["User"] = relationship(back_populates="owned_wells", foreign_keys=[owner_id])
    access_list: Mapped[list["WellAccess"]] = relationship(
        back_populates="well", cascade="all, delete-orphan",
    )

    computations: Mapped[list["Computation"]] = relationship(
        back_populates="well",
        cascade="all, delete-orphan",
    )

    __table_args__ = (Index("ix_wells_owner_name", "owner_id", "well_name"),)



class WellAccess(Base, TimestampMixin):
    __tablename__ = "well_access"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    well_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("wells.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    permission: Mapped[WellPermission] = mapped_column(
        SAEnum(
            WellPermission,
            name="well_permission",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=WellPermission.READ,
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="shared_wells")
    well: Mapped["Well"] = relationship(back_populates="access_list")

    __table_args__ = (
        UniqueConstraint("user_id", "well_id", name="uq_user_well_access"),
    )


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    target_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    target_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    user: Mapped["User | None"] = relationship(back_populates="audit_entries")

class Computation(Base, TimestampMixin):
    """Сохранённый петрофизический расчёт."""
    __tablename__ = "computations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    well_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("wells.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    method: Mapped[str] = mapped_column(String(64), nullable=False)
    params: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    curve_mapping: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    output_mnemonic: Mapped[str] = mapped_column(String(64), nullable=False)
    data_path: Mapped[str] = mapped_column(String(512), nullable=False)
    warnings: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    num_samples: Mapped[int] = mapped_column(nullable=False)

    # Связи
    well: Mapped["Well"] = relationship(back_populates="computations")
    user: Mapped["User"] = relationship()

    def __repr__(self) -> str:
        return f"<Computation {self.method} → {self.output_mnemonic}>"