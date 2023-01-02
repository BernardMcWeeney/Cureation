from rest_framework import serializers
from .models import *


class APIUserSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = APIUser
        fields = [
              'id',
              'username',
              'email',
              'date_joined',
              'last_login',
              'is_superuser',
              'user_image',
              'first_name',
              'last_name'
             ]


