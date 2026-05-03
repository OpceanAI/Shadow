package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var (
	dbHost = os.Getenv("DB_HOST")
	dbPort = os.Getenv("DB_PORT")
	secretKey = os.Getenv("SECRET_KEY")
)

type Config struct {
	Port string
	Host string
}

type User struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Email string `json:"email"`
}

type UserService struct {
	db *gorm.DB
}

func NewUserService(db *gorm.DB) *UserService {
	return &UserService{db: db}
}

func (s *UserService) GetUser(id int) (*User, error) {
	var user User
	result := s.db.First(&user, id)
	if result.Error != nil {
		return nil, result.Error
	}
	return &user, nil
}

func (s *UserService) FetchUsers() ([]User, error) {
	resp, err := http.Get("https://api.example.com/users")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var users []User
	if err := json.NewDecoder(resp.Body).Decode(&users); err != nil {
		return nil, err
	}
	return users, nil
}

func loadConfig() *Config {
	return &Config{
		Port: os.Getenv("PORT"),
		Host: "localhost",
	}
}

func main() {
	cfg := loadConfig()

	db, err := gorm.Open(sqlite.Open("test.db"), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	userService := NewUserService(db)
	user, _ := userService.GetUser(1)
	fmt.Printf("User: %+v\n", user)

	router := gin.Default()
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	log.Fatal(router.Run(cfg.Host + ":" + cfg.Port))
}
