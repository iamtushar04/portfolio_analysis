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
    owner_id = Column(String, index=True, nullable=True) # Deterministic UUID from external auth
    kyp_status = Column(String, default="pending") # pending, processing, completed, error
    
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
    
    # Ranked/Filtered Forward Assignees
    ranked_forward_assignees = Column(JSON, nullable=True) # list of dicts with scores/reasons
    
    # KYP Data
    kyp_score = Column(Integer, nullable=True) # Extracted top-level score for sorting
    kyp_score_data = Column(JSON, nullable=True) # Full weighted_score details
    kyp_classifications = Column(JSON, nullable=True) # Classification codes and descriptions
    
    status = Column(String, default="pending") # pending, success, failed
    error_message = Column(String, nullable=True)
    
    session = relationship("Session", back_populates="patents")

class TranslationCache(Base):
    __tablename__ = "translation_cache"
    
    original_text = Column(String, primary_key=True, index=True)
    english_text = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class AssigneeRelevanceCache(Base):
    __tablename__ = "assignee_relevance_cache"
    
    id = Column(Integer, primary_key=True, index=True)
    assignee_name = Column(String, index=True)
    technology_term = Column(String, index=True)
    term_type = Column(String) # "topic" or "subtopic"
    relevance_score = Column(Integer)
    reason = Column(String)
    source = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class InfringementAnalysisCache(Base):
    __tablename__ = "infringement_analysis_cache"
    
    patent_number = Column(String, primary_key=True, index=True)
    result_data = Column(JSON, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow)

class ClaimChartCache(Base):
    __tablename__ = "claim_chart_cache"
    
    id = Column(Integer, primary_key=True, index=True)
    patent_number = Column(String, index=True, nullable=False)
    company = Column(String, index=True, nullable=False)
    model = Column(String, index=True, nullable=False)
    result_data = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
