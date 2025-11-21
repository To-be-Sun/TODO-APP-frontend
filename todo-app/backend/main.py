from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import timedelta

from database import get_db, User, Task, Category
from auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user
)
from config import settings

app = FastAPI(title="Todo Auth API")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydanticモデル
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    username: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    id: int
    email: str
    username: Optional[str]
    oauth_provider: Optional[str]

class TaskCreate(BaseModel):
    id: str
    title: str
    category: str
    status: str
    created_at: str
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None

class TaskResponse(BaseModel):
    id: str
    title: str
    category: str
    status: str
    created_at: str
    estimated_hours: Optional[float]
    actual_hours: Optional[float]

# 認証エンドポイント
@app.post("/api/auth/signup", response_model=Token)
def signup(user: UserCreate, db: Session = Depends(get_db)):
    # 既存ユーザーチェック
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # 新規ユーザー作成
    hashed_password = get_password_hash(user.password)
    new_user = User(
        email=user.email,
        username=user.username,
        hashed_password=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # トークン発行
    access_token = create_access_token(data={"sub": new_user.id})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/auth/login", response_model=Token)
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not db_user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": db_user.id})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# タスクエンドポイント
@app.get("/api/tasks", response_model=List[TaskResponse])
def get_tasks(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tasks = db.query(Task).filter(Task.user_id == current_user.id).all()
    return tasks

@app.post("/api/tasks")
def create_task(
    task: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_task = Task(
        id=task.id,
        user_id=current_user.id,
        title=task.title,
        category=task.category,
        status=task.status,
        created_at=task.created_at,
        estimated_hours=task.estimated_hours,
        actual_hours=task.actual_hours
    )
    db.add(new_task)
    db.commit()
    return {"message": "Task created"}

@app.put("/api/tasks/{task_id}")
def update_task(
    task_id: str,
    task: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_task = db.query(Task).filter(
        Task.id == task_id,
        Task.user_id == current_user.id
    ).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db_task.title = task.title
    db_task.category = task.category
    db_task.status = task.status
    db_task.estimated_hours = task.estimated_hours
    db_task.actual_hours = task.actual_hours
    db.commit()
    return {"message": "Task updated"}

@app.delete("/api/tasks/{task_id}")
def delete_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_task = db.query(Task).filter(
        Task.id == task_id,
        Task.user_id == current_user.id
    ).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(db_task)
    db.commit()
    return {"message": "Task deleted"}

# カテゴリエンドポイント
@app.get("/api/categories")
def get_categories(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    categories = db.query(Category).filter(Category.user_id == current_user.id).all()
    return [cat.name for cat in categories]

@app.post("/api/categories")
def create_category(
    category_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_category = Category(user_id=current_user.id, name=category_name)
    db.add(new_category)
    db.commit()
    return {"message": "Category created"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
