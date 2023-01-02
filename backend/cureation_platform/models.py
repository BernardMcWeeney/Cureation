from django.db import models

# Create your models here.


from django.contrib.auth.models import AbstractUser


class APIUser(AbstractUser):
    user_image = models.FileField(upload_to='images/user_images/', default='images/user_images/defaultUser.jpg')
