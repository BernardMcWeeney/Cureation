from django.db import models
from wagtail.api import APIField
from wagtail.fields import RichTextField
from wagtail.models import Orderable, Page


class BlogPageAuthor(Orderable):
    page = models.ForeignKey('blog.BlogPage', on_delete=models.CASCADE, related_name='authors')
    name = models.CharField(max_length=255)

    api_fields = [
        APIField('name'),
    ]


class BlogPage(Page):
    published_date = models.DateTimeField()
    body = RichTextField()
    feed_image = models.ForeignKey('wagtailimages.Image', on_delete=models.SET_NULL, null=True)
    private_field = models.CharField(max_length=255)

    # Export fields over the API
    api_fields = [
        APIField('published_date'),
        APIField('body'),
        APIField('feed_image'),
        APIField('authors'),  # This will nest the relevant BlogPageAuthor objects in the API response
    ]
