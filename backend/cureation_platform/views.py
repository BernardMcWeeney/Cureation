from rest_framework import viewsets
from rest_framework import generics
from django.db.models import Q
from django.shortcuts import render
from .models import *
from .serializers import *
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny


class APIUserViewSet(viewsets.ModelViewSet):
    queryset = APIUser.objects.all()
    serializer_class = APIUserSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        user = self.request.user  # get the current user
        if user.is_superuser:
            return APIUser.objects.all()  # return all the users if a superuser requests
        else:
            # For normal users, only return the current users info
            apiuser_current = APIUser.objects.filter(username=user)
            return apiuser_current
