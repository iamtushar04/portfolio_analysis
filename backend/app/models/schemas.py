from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
# pyrefly: ignore [missing-import]
from ..database import Base

class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(String, primary_key=True, index=True) # UUID string
    name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="pending") # pending, processing, completed, error
    total_patents = Column(Integer, default=0)
    processed_patents = Column(Integer, default=0)
    
    patents = relationship("PatentData", back_populates="session", cascade="all, delete")

class PatentData(Base):
    __tablename__ = "patent_data"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    patent_number = Column(String, index=True)
    
    # Wissen API Data
    title = Column(String, nullable=True)
    assignees = Column(JSON, nullable=True)
    abstract = Column(String, nullable=True)
    claims = Column(String, nullable=True)
    
    # Deduplicated Citation Data (stored as JSON array of strings)
    forward_citations = Column(JSON, nullable=True)
    backward_citations = Column(JSON, nullable=True)
    
    # Taxonomy Data (from OpenAI)
    taxonomies = Column(JSON, nullable=True) # list of dicts with domain, topic, subtopic
    
    # Sparta API Data
    standard = Column(String, nullable=True)
    standard_links = Column(String, nullable=True)
    
    # Competitor API Data
    competitors = Column(JSON, nullable=True) # list of strings (legacy/main)
    forward_competitors = Column(JSON, nullable=True) # list of strings from forward citations
    backward_competitors = Column(JSON, nullable=True) # list of strings from backward citations
    
    status = Column(String, default="pending") # pending, success, failed
    error_message = Column(String, nullable=True)
    
    session = relationship("Session", back_populates="patents")
